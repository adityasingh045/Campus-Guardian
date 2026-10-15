import { useMemo, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import CameraGrid from './components/CameraGrid.jsx'
import SystemStatusBar from './components/SystemStatusBar.jsx'
import IncidentsFeed from './components/IncidentsFeed.jsx'
import IncidentHistory from './components/IncidentHistory.jsx'
import AlertDetailsPanel from './components/AlertDetailsPanel.jsx'
import { useWebSocket } from './hooks/useWebSocket.js'
import { useSources } from './hooks/useSources.js'
import { useIncidents } from './hooks/useIncidents.js'
import PhoneCameraManager from './components/PhoneCameraManager.jsx'
import PhoneCameraPage from './components/PhoneCameraPage.jsx'
import { api } from './utils/api.js'

export default function App() {
  if (window.location.pathname === '/phone-camera') return <PhoneCameraPage />
  const { framesBySource, latestIncidentEvent, connected } = useWebSocket()
  const { sources, refresh: refreshSources } = useSources()
  const { incidents, activeCount, loading, error, loadMore, hasMore } = useIncidents(latestIncidentEvent)
  const [detailsIncident, setDetailsIncident] = useState(null)
  const [historySourceId, setHistorySourceId] = useState(null)

  async function removeSource(sourceId) {
    if (!window.confirm(`Remove camera source ${sourceId}?`)) return
    try { await api.removeSource(sourceId); await refreshSources() }
    catch (error) { window.alert(error.message || 'Could not remove source') }
  }

  const camerasOnline = useMemo(() => sources.filter((s) => s.status === 'online').length, [sources])
  const systemStatus = useMemo(() => {
    if (sources.length === 0) return 'starting'
    if (camerasOnline === 0) return 'down'
    if (camerasOnline < sources.length) return 'degraded'
    return 'ok'
  }, [sources, camerasOnline])

  return (
    <div className="h-full flex flex-col">
      <Navbar connected={connected} engineStatus={activeCount > 0 ? 'DANGER' : 'SAFE'} />
      <div className="px-4 pt-3">
        <SystemStatusBar
          camerasOnline={camerasOnline}
          camerasTotal={sources.length}
          activeIncidents={activeCount}
          systemStatus={systemStatus}
        />
      </div>
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-4 p-4 overflow-hidden">
        <div className="min-h-0 overflow-y-auto space-y-3">
          <PhoneCameraManager onAdded={refreshSources} />
          <CameraGrid sources={sources} framesBySource={framesBySource} onRemove={removeSource} />
          <IncidentHistory
            sources={sources}
            incidents={incidents}
            selectedSourceId={historySourceId}
            onSelectSource={setHistorySourceId}
            onViewDetails={setDetailsIncident}
          />
        </div>
        <div className="min-h-0">
          <IncidentsFeed incidents={incidents} loading={loading} error={error} loadMore={loadMore} hasMore={hasMore} />
        </div>
      </main>
      {detailsIncident && (
        <AlertDetailsPanel
          incident={detailsIncident}
          onClose={() => setDetailsIncident(null)}
          onViewHistory={(sourceId) => setHistorySourceId(sourceId)}
        />
      )}
    </div>
  )
}