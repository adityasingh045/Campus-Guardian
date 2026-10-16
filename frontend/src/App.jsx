import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import AlertDetailsPanel from './components/AlertDetailsPanel.jsx'
import CameraHistoryDrawer from './components/CameraHistoryDrawer.jsx'
import PhoneCameraPage from './components/PhoneCameraPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import CameraFullView from './pages/CameraFullView.jsx'
import CamerasPage from './pages/CamerasPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useSources } from './hooks/useSources.js'
import { useIncidents } from './hooks/useIncidents.js'
import { api } from './utils/api.js'
import { displayName, usePrefs } from './utils/prefs.js'
import { playAlertTone } from './utils/sound.js'

export default function App() {
  if (window.location.pathname === '/phone-camera') return <PhoneCameraPage />

  const p = usePrefs()
  const { framesBySource, latestIncidentEvent, connected } = useWebSocket()
  const { sources, refresh: refreshSources } = useSources()
  const { incidents, activeCount } = useIncidents(latestIncidentEvent)

  const [page, setPage] = useState('dashboard') // dashboard | fullview | cameras | history | settings
  const [navOpen, setNavOpen] = useState(false)
  const [fullViewId, setFullViewId] = useState(null)
  const [detailsIncident, setDetailsIncident] = useState(null)
  const [historySlotId, setHistorySlotId] = useState(null)
  const alertedRef = useRef(new Set())

  // Theme is applied from the persisted preference (toggle lives in Settings).
  useEffect(() => {
    document.documentElement.dataset.theme = p.theme
  }, [p.theme])

  /* Unified slot list: real sources first, then reserved placeholder slots. */
  const slots = useMemo(() => {
    const sourceSlots = sources.map((source, index) => ({
      kind: 'source',
      id: source.source_id,
      name: displayName(source, index, p.nameOverrides),
      source,
    }))
    const placeholderSlots = p.placeholders.map((ph) => ({
      kind: 'placeholder',
      id: ph.id,
      name: ph.name,
      note: ph.note,
    }))
    return [...sourceSlots, ...placeholderSlots]
  }, [sources, p.nameOverrides, p.placeholders])

  const slotById = (id) => slots.find((s) => s.id === id) || null

  /* Automatic alert: the moment the detection server reports a new active
     incident, play the tone and open the alert panel (both toggleable). */
  useEffect(() => {
    const event = latestIncidentEvent
    if (!event?.incident_id) return
    const active = event.state && event.state !== 'INCIDENT_RESOLVED'
    if (!active || alertedRef.current.has(event.incident_id)) return
    alertedRef.current.add(event.incident_id)
    if (p.sound) playAlertTone()
    if (p.autoPopup) {
      setDetailsIncident((current) =>
        current?.incident_id === event.incident_id
          ? current
          : {
              started_at: new Date().toISOString(),
              people_involved: [],
              timeline: [],
              ...event,
            },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestIncidentEvent])

  /* Keep the open alert panel in sync as richer incident data arrives. */
  useEffect(() => {
    setDetailsIncident((current) => {
      if (!current || current.test) return current
      const fresh = incidents.find((i) => i.incident_id === current.incident_id)
      return fresh ? { ...current, ...fresh } : current
    })
  }, [incidents])

  async function removeSource(sourceId) {
    if (!window.confirm(`Remove camera source ${sourceId}?`)) return
    try {
      await api.removeSource(sourceId)
      await refreshSources()
      if (fullViewId === sourceId) {
        setFullViewId(null)
        setPage('dashboard')
      }
    } catch (error) {
      window.alert(error.message || 'Could not remove source')
    }
  }

  function navigate(target) {
    setPage(target)
    setFullViewId(null)
    if (window.innerWidth < 1024) setNavOpen(false)
  }

  function openCamera(slotId) {
    setFullViewId(slotId)
    setPage('fullview')
  }

  function triggerTestAlert(slotId) {
    const slot = slotById(slotId) || slots[0]
    const now = new Date()
    if (p.sound) playAlertTone()
    setDetailsIncident({
      test: true,
      incident_id: `TEST-${now.getTime().toString(36).toUpperCase()}`,
      source_id: slot?.id || 'TEST-CAM',
      location: slot?.name || 'Test camera',
      state: 'ALERT_SENT',
      description: 'Interface test alert — rehearsing the response flow.',
      people_involved: [1, 2],
      peak_movement: 42,
      timeline: [],
      started_at: now.toISOString(),
      has_snapshot: false,
    })
  }

  const camerasOnline = useMemo(() => sources.filter((s) => s.status === 'online').length, [sources])
  const systemStatus = useMemo(() => {
    if (sources.length === 0) return 'starting'
    if (camerasOnline === 0) return 'down'
    if (camerasOnline < sources.length) return 'degraded'
    return 'ok'
  }, [sources, camerasOnline])

  const unreviewedCount = useMemo(
    () => incidents.filter((i) => !p.reviewed.includes(i.incident_id)).length,
    [incidents, p.reviewed],
  )

  const fullViewSlot = fullViewId ? slotById(fullViewId) : null
  const fullViewIndex = fullViewSlot ? slots.indexOf(fullViewSlot) : 0

  /* The history drawer must also work for cameras that only exist in old
     records (sources removed after their incidents were saved). */
  const historySlot = useMemo(() => {
    if (!historySlotId) return null
    const known = slotById(historySlotId)
    if (known) return known
    const fromHistory = incidents.find((i) => i.source_id === historySlotId)
    if (!fromHistory) return null
    return {
      kind: 'source',
      id: historySlotId,
      name: fromHistory.location || historySlotId,
      source: { source_id: historySlotId, status: 'offline' },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySlotId, slots, incidents])

  const detailsCameraName = detailsIncident
    ? slotById(detailsIncident.source_id)?.name || detailsIncident.location
    : null

  return (
    <div className="h-full">
      <Sidebar
        open={navOpen}
        page={page}
        badgeCount={unreviewedCount}
        onNavigate={navigate}
        onClose={() => setNavOpen(false)}
      />

      <div
        className={`flex h-full min-h-0 flex-col transition-[margin] duration-200 ${
          navOpen ? 'lg:ml-60' : ''
        }`}
      >
        <TopBar
          page={page}
          connected={connected}
          engineStatus={activeCount > 0 ? 'DANGER' : 'SAFE'}
          onToggleNav={() => setNavOpen((v) => !v)}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto w-full max-w-6xl">
            {page === 'dashboard' && (
              <DashboardPage
                slots={slots}
                framesBySource={framesBySource}
                incidents={incidents}
                camerasOnline={camerasOnline}
                camerasTotal={sources.length}
                activeIncidents={activeCount}
                systemStatus={systemStatus}
                onOpenCamera={openCamera}
              />
            )}
            {page === 'fullview' &&
              (fullViewSlot ? (
                <CameraFullView
                  slot={fullViewSlot}
                  index={fullViewIndex}
                  frame={fullViewSlot.kind === 'source' ? framesBySource[fullViewSlot.id] : null}
                  lastIncident={incidents.find((i) => i.source_id === fullViewSlot.id)}
                  onBack={() => navigate('dashboard')}
                  onViewHistory={(slotId) => setHistorySlotId(slotId)}
                />
              ) : (
                <DashboardPage
                  slots={slots}
                  framesBySource={framesBySource}
                  incidents={incidents}
                  camerasOnline={camerasOnline}
                  camerasTotal={sources.length}
                  activeIncidents={activeCount}
                  systemStatus={systemStatus}
                  onOpenCamera={openCamera}
                />
              ))}
            {page === 'cameras' && (
              <CamerasPage
                slots={slots}
                onRemoveSource={removeSource}
                onSourcesChanged={refreshSources}
              />
            )}
            {page === 'history' && (
              <HistoryPage
                slots={slots}
                incidents={incidents}
                onViewDetails={setDetailsIncident}
                onOpenCameraHistory={setHistorySlotId}
              />
            )}
            {page === 'settings' && <SettingsPage slots={slots} onTestAlert={triggerTestAlert} />}
          </div>
        </main>
      </div>

      {historySlot && (
        <CameraHistoryDrawer
          slot={historySlot}
          incidents={incidents}
          onClose={() => setHistorySlotId(null)}
          onViewDetails={setDetailsIncident}
        />
      )}

      {detailsIncident && (
        <AlertDetailsPanel
          incident={detailsIncident}
          cameraName={detailsCameraName}
          onClose={() => setDetailsIncident(null)}
          onViewHistory={(sourceId) => setHistorySlotId(sourceId)}
        />
      )}
    </div>
  )
}