export default function SystemStatusBar({ camerasOnline, camerasTotal, activeIncidents, systemStatus }) {
    const statusColor = systemStatus === 'ok' ? 'text-emerald-400' : systemStatus === 'degraded' ? 'text-amber-400' : 'text-red-400'
    return (
      <div className="flex items-center gap-6 px-4 py-2 bg-slate-900 rounded-lg border border-slate-800 text-sm">
        <div>
          <span className="text-slate-500">ACTIVE INCIDENTS </span>
          <span className={activeIncidents > 0 ? 'text-red-400 font-semibold' : 'text-slate-200 font-semibold'}>
            {activeIncidents}
          </span>
        </div>
        <div>
          <span className="text-slate-500">CAMERAS ONLINE </span>
          <span className="text-slate-200 font-semibold">{camerasOnline}/{camerasTotal}</span>
        </div>
        <div>
          <span className="text-slate-500">SYSTEM STATUS </span>
          <span className={`font-semibold uppercase ${statusColor}`}>{systemStatus}</span>
        </div>
      </div>
    )
  }
  