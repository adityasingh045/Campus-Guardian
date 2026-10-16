const ITEMS = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      ),
    },
    {
      id: 'cameras',
      label: 'Cameras',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
          <rect x="2" y="6" width="14" height="12" rx="2" /><path d="M16 10.5 22 7v10l-6-3.5" />
        </svg>
      ),
    },
    {
      id: 'history',
      label: 'History',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0">
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />
        </svg>
      ),
    },
  ]
  
  /* Navigation drawer: hidden by default, opened with the hamburger button.
     On large screens it pushes the content aside; on small screens it overlays
     the page behind a scrim. */
  export default function Sidebar({ open, page, badgeCount, onNavigate, onClose }) {
    return (
      <>
        <div
          onClick={onClose}
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-slate-800 bg-slate-900 p-3 transition-transform duration-200 ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-teal-800 bg-teal-950 text-sm font-bold text-teal-300">
              CG
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold tracking-wide">CAMPUS GUARDIAN</div>
              <div className="text-[11px] text-slate-500">Campus safety monitoring</div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto rounded-md border border-slate-700 px-2 py-0.5 text-slate-400 hover:bg-slate-800"
              title="Close menu"
            >
              ✕
            </button>
          </div>
  
          <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Menu</div>
          {ITEMS.map((item) => {
            const active = page === item.id || (page === 'fullview' && item.id === 'dashboard')
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  active
                    ? 'border border-teal-800 bg-teal-950 font-semibold text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
                {item.id === 'history' && badgeCount > 0 && (
                  <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </button>
            )
          })}
        </aside>
      </>
    )
  }