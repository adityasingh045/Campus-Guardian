import { useMemo } from 'react'
import { usePrefs } from '../utils/prefs.js'
import SnapshotThumb from './SnapshotThumb.jsx'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

/* Right-side drawer with one camera's complete incident list and snapshot
   gallery. Opened from a camera's full view, the History page, or the
   "View camera history" button in alert details. */
export default function CameraHistoryDrawer({ slot, incidents, onClose, onViewDetails }) {
  const p = usePrefs()
  const cameraIncidents = useMemo(
    () => (slot?.kind === 'source' ? incidents.filter((i) => i.source_id === slot.id) : []),
    [slot, incidents],
  )
  const withSnapshots = cameraIncidents.filter((i) => i.has_snapshot)

  if (!slot) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full space-y-4 overflow-y-auto border-l border-slate-800 bg-slate-950 p-5 sm:w-[420px]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Camera history</p>
            <h2 className="mt-1 text-2xl font-bold">{slot.name}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {cameraIncidents.length} incident{cameraIncidents.length === 1 ? '' : 's'} on record
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5">
          {cameraIncidents.length === 0 && (
            <p className="text-sm text-slate-500">
              {slot.kind === 'source'
                ? 'Nothing detected on this camera yet.'
                : 'This slot is not connected to a camera yet.'}
            </p>
          )}
          {cameraIncidents.map((incident) => {
            const reviewed = p.reviewed.includes(incident.incident_id)
            return (
              <div
                key={incident.incident_id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
              >
                <div className="text-[13px] font-medium text-slate-100">
                  {incident.description || 'Suspicious activity detected — requires review.'}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {formatDateTime(incident.started_at)} · {incident.incident_id} ·{' '}
                  {(incident.people_involved || []).length} people
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      reviewed
                        ? 'border border-slate-700 bg-slate-800 text-slate-400'
                        : 'border border-red-800 bg-red-950 text-red-300'
                    }`}
                  >
                    {reviewed ? 'Reviewed' : 'Needs review'}
                  </span>
                  <button
                    onClick={() => onViewDetails(incident)}
                    className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300"
                  >
                    View details
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {withSnapshots.length > 0 && (
          <div className="space-y-2 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-300">Saved snapshots</h3>
              <span className="text-[11px] text-slate-500">{withSnapshots.length} stored</span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {withSnapshots.map((incident) => (
                <SnapshotThumb key={incident.incident_id} incident={incident} onOpen={onViewDetails} />
              ))}
            </div>
          </div>
        )}
      </aside>
    </>
  )
}