import { useState } from 'react'
import { api } from '../utils/api.js'
import { prefs, usePrefs } from '../utils/prefs.js'

function makePhoneId() {
  return `PHONE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

const STATUS_DOT = {
  online: 'bg-emerald-500',
  processing: 'bg-blue-500',
  starting: 'bg-amber-500',
  error: 'bg-red-500',
  offline: 'bg-slate-600',
}

function SourceRow({ slot, index, onRemove }) {
  const [name, setName] = useState(slot.name)
  const source = slot.source
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-teal-800 bg-teal-950 text-xs font-bold text-teal-300">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder="Camera name"
        />
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[source.status] || 'bg-slate-600'}`} />
          {source.source_id} · {source.source_type || 'camera'} · {source.status}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => prefs.setCameraName(source.source_id, name)}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-500"
        >
          Save name
        </button>
        <button
          onClick={() => onRemove(source.source_id)}
          className="rounded-lg border border-red-800 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

function PlaceholderRow({ slot, index }) {
  const [name, setName] = useState(slot.name)
  const [note, setNote] = useState(slot.note || '')
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400">
        {String(index + 1).padStart(2, '0')}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Camera name"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Source note"
          />
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Standby — will activate when a feed is attached
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => prefs.updatePlaceholder(slot.id, { name: name.trim() || slot.name, note: note.trim() })}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-500"
        >
          Save
        </button>
        <button
          onClick={() => prefs.removePlaceholder(slot.id)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
        >
          Remove
        </button>
      </div>
    </div>
  )
}

/* Cameras page: rename every slot, remove sources, and add new cameras —
   either a live phone camera (registered with the detection server) or a
   reserved slot that is connected later. */
export default function CamerasPage({ slots, onRemoveSource, onSourcesChanged }) {
  usePrefs()
  const [addName, setAddName] = useState('')
  const [addNote, setAddNote] = useState('')
  const [addType, setAddType] = useState('phone')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [links, setLinks] = useState([])

  async function addCamera() {
    const name = addName.trim()
    if (!name) {
      setError('Give the camera a name first.')
      return
    }
    setError('')
    if (addType === 'slot') {
      prefs.addPlaceholder(name, addNote)
      setAddName('')
      setAddNote('')
      return
    }
    setBusy(true)
    const sourceId = makePhoneId()
    try {
      await api.registerPhoneCamera({ source_id: sourceId, location: name })
      const url = `${window.location.origin}/phone-camera?source=${encodeURIComponent(
        sourceId,
      )}&location=${encodeURIComponent(name)}`
      setLinks((old) => [{ sourceId, name, url }, ...old])
      if (addNote.trim()) prefs.setCameraName(sourceId, name)
      setAddName('')
      setAddNote('')
      onSourcesChanged?.()
    } catch (e) {
      setError(e.message || 'Could not register the camera.')
    } finally {
      setBusy(false)
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Copy was blocked by the browser. Select and copy the camera link manually.')
    }
  }

  const sourceSlots = slots.filter((s) => s.kind === 'source')
  const placeholderSlots = slots.filter((s) => s.kind === 'placeholder')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Device management</p>
        <h2 className="mt-1 text-lg font-bold">Camera setup</h2>
        <p className="mt-1 text-xs text-slate-400">
          Name each monitoring point. Live feeds connect to the detection server per camera.
        </p>
      </div>

      <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900">
        {sourceSlots.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No live cameras connected yet.</p>
        )}
        {sourceSlots.map((slot, i) => (
          <SourceRow key={slot.id} slot={slot} index={i} onRemove={onRemoveSource} />
        ))}
        {placeholderSlots.map((slot, i) => (
          <PlaceholderRow key={slot.id} slot={slot} index={sourceSlots.length + i} />
        ))}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Expand coverage</p>
        <h2 className="mt-1 text-lg font-bold">Add a camera</h2>
        <p className="mt-1 text-xs text-slate-400">
          A phone camera goes live immediately through the detection server; a reserved slot appears
          on the dashboard and is connected later.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Camera name</label>
            <input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. Library Entrance"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">Source note (optional)</label>
            <input
              value={addNote}
              onChange={(e) => setAddNote(e.target.value)}
              placeholder="e.g. Phone camera · north wall"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="phone">Phone camera (live feed)</option>
            <option value="slot">Reserved slot (connect later)</option>
          </select>
          <button
            onClick={addCamera}
            disabled={busy}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
          >
            {busy ? 'Adding…' : '+ Add camera'}
          </button>
        </div>
        {error && <p className="text-xs text-red-300">{error}</p>}
        {links.map((item) => (
          <div key={item.sourceId} className="space-y-2 rounded-lg border border-slate-800 p-3">
            <div className="text-sm font-medium">
              {item.name} <span className="text-xs text-slate-500">· {item.sourceId}</span>
            </div>
            <p className="break-all text-xs text-slate-400">{item.url}</p>
            <div className="flex gap-2">
              <button
                onClick={() => copy(item.url)}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs"
              >
                Copy phone link
              </button>
              <button
                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs"
              >
                Open on this device
              </button>
            </div>
            <p className="text-xs text-amber-300">
              For another phone, open this link using the dashboard's LAN address (not localhost).
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}