const STATUS_DOT = {
  online: 'bg-emerald-500',
  processing: 'bg-blue-500 animate-pulse',
  starting: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
  offline: 'bg-slate-600',
}

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

/* One dashboard slot. `slot.kind` is either 'source' (a real camera backed by
   the detection server) or 'placeholder' (a reserved, not-yet-connected slot).
   Tapping anywhere on the card opens the camera full view. */
export default function CameraCard({ slot, index, frame, lastIncident, onOpen }) {
  const isSource = slot.kind === 'source'
  const source = slot.source
  const stats = frame?.stats
  const live = isSource && Boolean(frame)
  const alerting = Boolean(stats?.active_incident_id)

  return (
    <div
      onClick={() => onOpen(slot.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(slot.id) }}
      className={`cursor-pointer rounded-xl border bg-slate-900 transition hover:-translate-y-0.5 hover:border-teal-700 ${
        alerting ? 'border-red-700' : 'border-slate-800'
      }`}
    >
      <div className="flex items-start gap-2.5 p-3 pb-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-teal-800 bg-teal-950 text-xs font-bold text-teal-300">
          {String(index + 1).padStart(2, '0')}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{slot.name}</div>
          <div className="truncate text-[11px] text-slate-500">
            {isSource ? source.source_id : slot.note || 'Reserved slot'}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold tracking-wider ${
            live
              ? 'bg-emerald-950 text-emerald-300'
              : isSource
                ? 'bg-amber-950 text-amber-300'
                : 'bg-slate-800 text-slate-400'
          }`}
        >
          {live ? '● LIVE FEED' : isSource ? '● WAITING' : '● NOT CONNECTED'}
        </span>
      </div>

      <div className="relative mx-3 aspect-video overflow-hidden rounded-lg bg-black">
        {live ? (
          <img
            src={`data:image/jpeg;base64,${frame.frame}`}
            alt={`${slot.name} live feed`}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-slate-600">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-slate-700 text-teal-500">▣</div>
            <div className="text-xs font-medium text-slate-400">
              {isSource ? (source.status === 'offline' ? 'Camera offline' : 'Waiting for frames…') : 'Camera not connected'}
            </div>
            <div className="text-[10px] text-slate-600">
              {isSource ? 'The detection server is preparing this feed.' : 'This slot is reserved for a camera.'}
            </div>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] tracking-widest text-slate-300">
          SCREEN {String(index + 1).padStart(2, '0')}
        </span>
        {stats?.using_synthetic_feed && (
          <span className="absolute right-2 top-2 rounded bg-amber-900/80 px-1.5 py-0.5 text-[10px] text-amber-200">
            synthetic feed
          </span>
        )}
        {alerting && (
          <span className="absolute bottom-2 right-2 animate-pulse rounded bg-red-900/90 px-1.5 py-0.5 text-[10px] text-red-200">
            {stats.active_incident_id}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isSource ? STATUS_DOT[source.status] || 'bg-slate-600' : 'bg-amber-500'
            }`}
          />
          {isSource
            ? `${stats?.person_count ?? source.person_count ?? 0} people · move ${Math.round(
                stats?.max_movement ?? source.max_movement ?? 0,
              )}px`
            : 'Standby'}
        </span>
        <span className="truncate pl-2">
          {lastIncident ? `Last incident: ${formatDateTime(lastIncident.started_at)}` : 'No incidents yet'}
        </span>
      </div>
    </div>
  )
}