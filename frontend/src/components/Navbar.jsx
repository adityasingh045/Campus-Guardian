import StatusBadge from './StatusBadge.jsx'

export default function Navbar({ connected, engineStatus }) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold tracking-tight">Campus Guardian</span>
        <span className="text-xs text-slate-500">live monitoring</span>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={engineStatus} />
        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>
          {connected ? 'WS connected' : 'WS disconnected'}
        </span>
      </div>
    </header>
  )
}
