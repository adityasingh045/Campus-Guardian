import IncidentCard from './IncidentCard.jsx'

export default function IncidentsFeed({ incidents, loading, error, loadMore, hasMore }) {
  return (
    <div className="bg-slate-900 rounded-lg p-4 flex flex-col h-full">
      <h2 className="text-sm font-semibold text-slate-300 mb-3">Incidents</h2>
      {error && <div className="text-xs text-red-400 mb-2">Failed to load incidents: {error}</div>}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading && incidents.length === 0 && <div className="text-sm text-slate-500">Loading…</div>}
        {!loading && incidents.length === 0 && <div className="text-sm text-slate-500">No incidents yet.</div>}
        {incidents.map((inc) => (
          <IncidentCard key={inc.incident_id} incident={inc} />
        ))}
      </div>
      {hasMore && (
        <button
          onClick={loadMore}
          className="mt-3 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded py-1.5"
        >
          Load more
        </button>
      )}
    </div>
  )
}
