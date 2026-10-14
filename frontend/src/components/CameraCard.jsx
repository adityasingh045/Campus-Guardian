import StatusBadge from './StatusBadge.jsx'

const STATUS_DOT = {
  online: 'bg-emerald-500',
  processing: 'bg-blue-500 animate-pulse',
  starting: 'bg-amber-500 animate-pulse',
  error: 'bg-red-500',
  offline: 'bg-slate-600',
}

function statusBadge(status) {
  return status === 'SUSPICIOUS' ? 'DANGER' : 'SAFE'
}

export default function CameraCard({ source, frame, onRemove }) {
  const stats = frame?.stats
  return (
    <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
      <div className="relative bg-black aspect-video flex items-center justify-center">
        {frame ? (
          <img
            src={`data:image/jpeg;base64,${frame.frame}`}
            alt={`${source.location} live feed`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-slate-600 text-xs">
            {source.status === 'offline' ? 'Offline' : 'Waiting for frames…'}
          </div>
        )}
        {stats?.using_synthetic_feed && (
          <div className="absolute top-1.5 left-1.5 text-[10px] bg-amber-900/80 text-amber-200 px-1.5 py-0.5 rounded">
            synthetic feed
          </div>
        )}
        {stats?.active_incident_id && (
          <div className="absolute top-1.5 right-1.5 text-[10px] bg-red-900/90 text-red-200 px-1.5 py-0.5 rounded animate-pulse">
            {stats.active_incident_id}
          </div>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{source.location}</span>
          <div className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${STATUS_DOT[source.status] || 'bg-slate-600'}`} title={source.status} />{onRemove && <button onClick={() => onRemove(source.source_id)} className="text-[10px] text-slate-500 hover:text-red-300" title="Remove camera source">Remove</button>}</div>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{source.source_id}</span>
          <span>{stats?.person_count ?? source.person_count ?? 0} people</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            move {Math.round(stats?.max_movement ?? source.max_movement ?? 0)}px · closest{' '}
            {(stats?.closest_distance ?? source.closest_distance) != null
              ? `${Math.round(stats?.closest_distance ?? source.closest_distance)}px`
              : '--'}
          </span>
          <StatusBadge status={statusBadge(stats?.status ?? source.activity_status)} />
        </div>
      </div>
    </div>
  )
}
