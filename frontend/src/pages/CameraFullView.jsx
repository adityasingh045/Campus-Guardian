import { useEffect, useState } from 'react'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

/* Full-screen view of one camera: live feed, name, time of the last
   detection, and a button that opens this camera's history drawer. */
export default function CameraFullView({ slot, index, frame, lastIncident, onBack, onViewHistory }) {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!slot) return null
  const isSource = slot.kind === 'source'
  const source = slot.source
  const stats = frame?.stats
  const live = isSource && Boolean(frame)
  const alerting = Boolean(stats?.active_incident_id)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Camera full view</p>
          <h2 className="mt-1 text-2xl font-bold">{slot.name}</h2>
          <p className="mt-1 text-xs text-slate-400">
            {live
              ? 'Live feed · detection active'
              : isSource
                ? 'Connected — waiting for frames from the detection server'
                : 'Not connected — slot reserved'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => onViewHistory(slot.id)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            View history
          </button>
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            title="Back to dashboard"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
        <div
          className={`relative overflow-hidden rounded-lg bg-black ${
            alerting ? 'ring-2 ring-red-600' : ''
          }`}
          style={{ aspectRatio: '16 / 8.5' }}
        >
          {live ? (
            <img
              src={`data:image/jpeg;base64,${frame.frame}`}
              alt={`${slot.name} live feed`}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-600">
              <div className="grid h-12 w-12 place-items-center rounded-xl border border-slate-700 text-xl text-teal-500">
                ▣
              </div>
              <div className="text-sm font-medium text-slate-400">
                {isSource
                  ? source.status === 'offline'
                    ? 'Camera offline'
                    : 'Waiting for frames…'
                  : 'Camera not connected'}
              </div>
              <div className="text-xs text-slate-600">
                {isSource
                  ? 'The detection server is preparing this feed.'
                  : 'This slot is reserved for a future camera.'}
              </div>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] tracking-widest text-slate-300">
            SCREEN {String(index + 1).padStart(2, '0')}
          </span>
          <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-[10px] text-slate-300">
            {clock}
          </span>
          {lastIncident && (
            <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-[11px] text-red-300">
              Last detection: {formatDateTime(lastIncident.started_at)}
            </span>
          )}
          {stats?.using_synthetic_feed && (
            <span className="absolute bottom-3 left-3 rounded bg-amber-900/80 px-2 py-1 text-[10px] text-amber-200">
              synthetic feed
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Source: {isSource ? source.source_id : slot.note || 'Reserved slot'}
            {isSource &&
              ` · ${stats?.person_count ?? source.person_count ?? 0} people · move ${Math.round(
                stats?.max_movement ?? source.max_movement ?? 0,
              )}px`}
          </span>
          <button
            onClick={onBack}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  )
}