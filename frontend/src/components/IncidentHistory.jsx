import { useEffect, useMemo, useState } from 'react'
import { api } from '../utils/api.js'

/* "Incident history" section styled after the design prototype:
   per-camera tabs (Screen 1..N), incident rows with View details /
   View snapshot, and a Saved snapshots grid. Data is 100% live. */

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

function SnapshotThumb({ incident, onOpen }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl
    const controller = new AbortController()
    api.getIncidentSnapshot(incident.incident_id, controller.signal)
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) })
      .catch((e) => { if (e.name !== 'AbortError') setFailed(true) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [incident.incident_id])

  if (failed) return null
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
      {url
        ? <img src={url} alt={`Snapshot ${incident.incident_id}`} className="w-full aspect-video object-cover" />
        : <div className="w-full aspect-video bg-slate-900 animate-pulse" />}
      <div className="p-3 space-y-1">
        <div className="text-xs font-medium text-slate-200">{incident.incident_id}</div>
        <div className="text-[11px] text-slate-500">{formatDateTime(incident.started_at)}</div>
        <button onClick={() => onOpen(incident)} className="text-[11px] text-cyan-400 hover:text-cyan-300">
          View snapshot ↗
        </button>
      </div>
    </div>
  )
}

export default function IncidentHistory({ sources, incidents, onViewDetails, selectedSourceId, onSelectSource }) {
  const [showSnapshots, setShowSnapshots] = useState(true)

  // Tabs: every configured source, plus any source that only exists in history.
  const tabs = useMemo(() => {
    const seen = new Map()
    sources.forEach((s) => seen.set(s.source_id, s.location))
    incidents.forEach((i) => { if (!seen.has(i.source_id)) seen.set(i.source_id, i.location) })
    return [...seen.entries()].map(([sourceId, location], idx) => ({
      sourceId, location, label: `Screen ${idx + 1}`,
    }))
  }, [sources, incidents])

  const active = tabs.find((t) => t.sourceId === selectedSourceId) || tabs[0]
  const cameraIncidents = useMemo(
    () => incidents.filter((i) => i.source_id === active?.sourceId),
    [incidents, active],
  )
  const withSnapshots = cameraIncidents.filter((i) => i.has_snapshot)

  if (tabs.length === 0) return null

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Saved incidents</p>
        <h2 className="text-lg font-bold mt-1">Incident history</h2>
        <p className="text-xs text-slate-400 mt-1">Each camera keeps its own incident list and snapshots.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.sourceId}
            onClick={() => onSelectSource(tab.sourceId)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              tab.sourceId === active?.sourceId
                ? 'border-teal-400/70 bg-teal-400/10 ring-1 ring-teal-400/40'
                : 'border-slate-700 bg-slate-900 hover:border-slate-500'
            }`}
          >
            <div className={`text-xs font-semibold ${tab.sourceId === active?.sourceId ? 'text-teal-300' : 'text-slate-200'}`}>
              {tab.label}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{tab.location}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{active?.location}</h3>
          <p className="text-[11px] text-slate-500">{cameraIncidents.length} incident{cameraIncidents.length === 1 ? '' : 's'} saved</p>
        </div>
        <button
          onClick={() => setShowSnapshots((v) => !v)}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          {showSnapshots ? 'Hide snapshots' : 'Show snapshots'}
        </button>
      </div>

      <div className="space-y-2">
        {cameraIncidents.length === 0 && (
          <p className="text-sm text-slate-500">No incidents recorded on this camera yet.</p>
        )}
        {cameraIncidents.map((incident) => {
          const needsReview = incident.state !== 'INCIDENT_RESOLVED'
          return (
            <div key={incident.incident_id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">
                  {incident.description || 'Suspicious activity detected — requires review.'}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {formatDateTime(incident.started_at)} · {incident.incident_id} · {(incident.people_involved || []).length} people
                </div>
                <span className={`inline-block mt-1.5 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  needsReview ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {needsReview ? 'Needs review' : 'Resolved'}
                </span>
              </div>
              <div className="flex sm:flex-col items-end gap-2 shrink-0">
                <button
                  onClick={() => onViewDetails(incident)}
                  className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
                >
                  View details
                </button>
                {incident.has_snapshot && (
                  <button onClick={() => onViewDetails(incident)} className="text-[11px] text-cyan-400 hover:text-cyan-300">
                    View snapshot
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showSnapshots && withSnapshots.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300">Saved snapshots</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {withSnapshots.map((incident) => (
              <SnapshotThumb key={incident.incident_id} incident={incident} onOpen={onViewDetails} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}