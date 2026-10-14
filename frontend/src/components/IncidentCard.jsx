import { useEffect, useState } from 'react'
import { api } from '../utils/api'

const STATE_STYLE = {
  ALERT_SENT: 'border-red-700 bg-red-950/50',
  INCIDENT_ACTIVE: 'border-red-700 bg-red-950/50',
  INCIDENT_RESOLVED: 'border-slate-700 bg-slate-800/30',
}

// Timeline `ts` arrives as an ISO string from the REST API but as a raw
// unix-seconds float from the live WebSocket event -- normalize both.
function formatTimelineTs(ts) {
  if (typeof ts === 'number') return new Date(ts * 1000).toLocaleTimeString()
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString()
}

export default function IncidentCard({ incident }) {
  const [expanded, setExpanded] = useState(false)
  const [snapshotUrl, setSnapshotUrl] = useState(null)
  const [snapshotError, setSnapshotError] = useState(false)

  useEffect(() => {
    if (!expanded || !incident.incident_id || !incident.has_snapshot) return undefined
    const controller = new AbortController()
    let objectUrl
    setSnapshotUrl(null)
    setSnapshotError(false)
    api.getIncidentSnapshot(incident.incident_id, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setSnapshotUrl(objectUrl)
        setSnapshotError(false)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setSnapshotError(true)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [expanded, incident.incident_id, incident.has_snapshot])
  const style = STATE_STYLE[incident.state] || 'border-slate-700 bg-slate-800/40'
  const time = incident.started_at ? new Date(incident.started_at).toLocaleTimeString() : ''

  return (
    <div className={`border rounded-md p-3 ${style}`}>
      <button onClick={() => setExpanded((e) => !e)} className="w-full text-left">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold">{incident.incident_id || 'Incident'}</span>
          <span className="text-xs text-slate-400">{time}</span>
        </div>
        <div className="text-xs text-slate-400 mb-1">
          {incident.location} · {incident.source_id} · {(incident.people_involved || []).length} people
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-slate-400">{incident.state?.replace(/_/g, ' ')}</span>
          <span className="text-xs text-slate-500">peak move {Math.round(incident.peak_movement || 0)}px</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-1">
          {(incident.timeline || []).length === 0 && <div className="text-xs text-slate-500">No timeline yet.</div>}
          {(incident.timeline || []).map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-slate-500 shrink-0">{formatTimelineTs(t.ts)}</span>
              <span className="text-slate-300">{t.label.replace(/_/g, ' ')}</span>
              {t.detail && <span className="text-slate-500">— {t.detail}</span>}
            </div>
          ))}
          {incident.has_snapshot && snapshotUrl && (
            <img src={snapshotUrl} alt="Incident evidence snapshot" className="w-full rounded border border-slate-700 mt-2" />
          )}
          {incident.has_snapshot && snapshotError && (
            <p className="text-xs text-amber-300 mt-2">Evidence snapshot could not be loaded.</p>
          )}
        </div>
      )}
    </div>
  )
}
