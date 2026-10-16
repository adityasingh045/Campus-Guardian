import { useMemo, useState } from 'react'
import { usePrefs } from '../utils/prefs.js'
import SnapshotThumb from '../components/SnapshotThumb.jsx'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

function IncidentRow({ incident, reviewed, onViewDetails }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">
          {incident.description || 'Suspicious activity detected — requires review.'}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          {formatDateTime(incident.started_at)} · {incident.incident_id} ·{' '}
          {(incident.people_involved || []).length} people
        </div>
        <span
          className={`mt-1.5 inline-block rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            reviewed
              ? 'border border-slate-700 bg-slate-800 text-slate-400'
              : 'border border-red-800 bg-red-950 text-red-300'
          }`}
        >
          {reviewed ? 'Reviewed' : 'Needs review'}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <button
          onClick={() => onViewDetails(incident)}
          className="rounded-md border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
        >
          View details
        </button>
        {incident.has_snapshot && (
          <button
            onClick={() => onViewDetails(incident)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300"
          >
            View snapshot
          </button>
        )}
      </div>
    </div>
  )
}

function CameraSection({ slot, index, incidents, onViewDetails, onOpenCameraHistory, reviewedIds }) {
  const [showSnapshots, setShowSnapshots] = useState(false)
  const withSnapshots = incidents.filter((i) => i.has_snapshot)
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold">
            Screen {index + 1} — {slot.name}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {incidents.length} incident{incidents.length === 1 ? '' : 's'} saved
            {withSnapshots.length > 0 && ` · ${withSnapshots.length} snapshot${withSnapshots.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {withSnapshots.length > 0 && (
            <button
              onClick={() => setShowSnapshots((v) => !v)}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              {showSnapshots ? 'Hide snapshots' : 'View snapshots'}
            </button>
          )}
          <button
            onClick={() => onOpenCameraHistory(slot.id)}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            View full history
          </button>
        </div>
      </div>

      {incidents.length === 0 && (
        <p className="border-t border-slate-800 p-4 text-sm text-slate-500">
          {slot.kind === 'source'
            ? 'No incidents recorded on this camera yet.'
            : 'This slot is not connected to a camera yet.'}
        </p>
      )}
      {incidents.slice(0, 3).map((incident) => (
        <IncidentRow
          key={incident.incident_id}
          incident={incident}
          reviewed={reviewedIds.includes(incident.incident_id)}
          onViewDetails={onViewDetails}
        />
      ))}
      {incidents.length > 3 && (
        <div className="border-t border-slate-800 p-4">
          <button
            onClick={() => onOpenCameraHistory(slot.id)}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300"
          >
            Show all {incidents.length} incidents →
          </button>
        </div>
      )}
      {showSnapshots && withSnapshots.length > 0 && (
        <div className="grid grid-cols-1 gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {withSnapshots.map((incident) => (
            <SnapshotThumb key={incident.incident_id} incident={incident} onOpen={onViewDetails} />
          ))}
        </div>
      )}
    </section>
  )
}

/* History page: one section per screen — each camera keeps its own incident
   list and snapshot gallery instead of a single merged feed. */
export default function HistoryPage({ slots, incidents, onViewDetails, onOpenCameraHistory }) {
  const p = usePrefs()

  // Include cameras that only exist in history (removed sources with records).
  const sections = useMemo(() => {
    const known = new Set(slots.filter((s) => s.kind === 'source').map((s) => s.id))
    const extras = []
    const seen = new Set()
    for (const incident of incidents) {
      if (!known.has(incident.source_id) && !seen.has(incident.source_id)) {
        seen.add(incident.source_id)
        extras.push({
          kind: 'source',
          id: incident.source_id,
          name: incident.location || incident.source_id,
          source: { source_id: incident.source_id, status: 'offline' },
        })
      }
    }
    return [...slots, ...extras]
  }, [slots, incidents])

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Saved incidents</p>
        <h2 className="mt-1 text-lg font-bold">Incident history</h2>
        <p className="mt-1 text-xs text-slate-400">Each camera keeps its own incident list and snapshots.</p>
      </div>
      {sections.map((slot, index) => (
        <CameraSection
          key={slot.id}
          slot={slot}
          index={index}
          incidents={slot.kind === 'source' ? incidents.filter((i) => i.source_id === slot.id) : []}
          onViewDetails={onViewDetails}
          onOpenCameraHistory={onOpenCameraHistory}
          reviewedIds={p.reviewed}
        />
      ))}
    </div>
  )
}