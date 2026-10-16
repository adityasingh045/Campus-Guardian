import { useEffect, useState } from 'react'
import StatusBadge from './StatusBadge.jsx'

const PAGE_TITLES = {
  dashboard: ['Dashboard', 'All monitoring points in one view.'],
  fullview: ['Camera full view', 'Live feed and incident timing for this camera.'],
  cameras: ['Cameras', 'Manage camera names and sources.'],
  history: ['History', 'Review incidents and snapshots by camera.'],
  settings: ['Settings', 'Control how the operations dashboard behaves.'],
}

export default function TopBar({ page, connected, engineStatus, onToggleNav }) {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(id)
  }, [])

  const [title, subtitle] = PAGE_TITLES[page] || PAGE_TITLES.dashboard

  return (
    <header className="flex items-center gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-3 sm:px-6">
      <button
        onClick={onToggleNav}
        aria-label="Open menu"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800"
      >
        <span className="relative block h-0.5 w-4 rounded bg-slate-200 before:absolute before:-top-[5px] before:left-0 before:h-0.5 before:w-4 before:rounded before:bg-slate-200 after:absolute after:top-[5px] after:left-0 after:h-0.5 after:w-4 after:rounded after:bg-slate-200 before:content-[''] after:content-['']" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Campus Guardian</div>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <p className="hidden truncate text-[11px] text-slate-500 sm:block">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-xs text-slate-500 md:block">{clock}</span>
        <StatusBadge status={engineStatus} />
        <span
          className={`rounded-full px-2 py-1 text-xs ${
            connected ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
          }`}
        >
          {connected ? 'WS connected' : 'WS disconnected'}
        </span>
      </div>
    </header>
  )
}