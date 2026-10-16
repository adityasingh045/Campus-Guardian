import { useSyncExternalStore } from 'react'

/* Persistent UI preferences. Incidents and camera sources live in the
   backend database — this store only keeps interface state (theme, sound,
   display names, reserved slots, reviewed flags) so a page refresh never
   loses what the operator set up. */

const KEY = 'campus-guardian-ui-v1'

const DEFAULTS = {
  theme: 'dark',
  sound: true,
  autoPopup: true,
  // source_id -> operator-chosen display name
  nameOverrides: {},
  // reserved dashboard slots that are not yet backed by a real camera
  placeholders: [
    { id: 'slot-gate2', name: 'Gate 2', note: 'Reserved slot' },
    { id: 'slot-parking', name: 'Parking Area', note: 'Reserved slot' },
  ],
  // incident ids the operator marked as reviewed
  reviewed: [],
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw)
    return { ...structuredClone(DEFAULTS), ...parsed }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

let state = load()
const listeners = new Set()

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* storage unavailable */ }
}
function emit() {
  for (const listener of listeners) listener()
}
function update(patch) {
  state = { ...state, ...patch }
  persist()
  emit()
}

export const prefs = {
  get: () => state,
  set: update,

  setCameraName(sourceId, name) {
    const nameOverrides = { ...state.nameOverrides }
    const trimmed = (name || '').trim()
    if (trimmed) nameOverrides[sourceId] = trimmed
    else delete nameOverrides[sourceId]
    update({ nameOverrides })
  },

  addPlaceholder(name, note) {
    const slot = {
      id: `slot-${Date.now().toString(36)}`,
      name: (name || '').trim() || 'New camera',
      note: (note || '').trim() || 'Reserved slot',
    }
    update({ placeholders: [...state.placeholders, slot] })
    return slot
  },
  updatePlaceholder(id, patch) {
    update({
      placeholders: state.placeholders.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })
  },
  removePlaceholder(id) {
    update({ placeholders: state.placeholders.filter((p) => p.id !== id) })
  },

  isReviewed: (incidentId) => state.reviewed.includes(incidentId),
  markReviewed(incidentId) {
    if (state.reviewed.includes(incidentId)) return
    update({ reviewed: [...state.reviewed, incidentId].slice(-500) })
  },

  reset() {
    state = structuredClone(DEFAULTS)
    persist()
    emit()
  },
}

export function usePrefs() {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    () => state,
  )
}

/* Display-name helper: operator override wins; generic backend labels such
   as "Camera 1" fall back to the named monitoring points. */
export const DEFAULT_SCREEN_NAMES = ['Main Gate', 'Campus Premises', 'Gate 2', 'Parking Area']

export function displayName(source, index, nameOverrides) {
  const override = nameOverrides?.[source.source_id]
  if (override) return override
  const location = (source.location || '').trim()
  if (!location || /^(camera|cam|screen|source)\s*[-_ ]?\d+$/i.test(location)) {
    return DEFAULT_SCREEN_NAMES[index] || `Camera ${index + 1}`
  }
  return location
}