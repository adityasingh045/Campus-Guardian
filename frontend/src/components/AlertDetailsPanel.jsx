import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

/* Right-side "Alert details" drawer styled after the design prototype,
   backed by live incident data: snapshot, evidence clip playback and
   a download button for the evidence mp4. */

function useBlobUrl(fetcher, deps) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let objectUrl
    const controller = new AbortController()
    setUrl(null); setError(null)
    fetcher(controller.signal)
      .then((blob) => { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) })
      .catch((e) => { if (e.name !== 'AbortError') setError(e) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return { url, error }
}

export default function AlertDetailsPanel({ incident, onClose, onViewHistory }) {
  const [reviewed, setReviewed] = useState(false)
  const [clipUrl, setClipUrl] = useState(null)
  const [clipState, setClipState] = useState('idle') // idle | loading | ready | missing | error

  const { url: snapshotUrl } = useBlobUrl(
    (signal) => incident?.has_snapshot
      ? api.getIncidentSnapshot(incident.incident_id, signal)
      : Promise.reject(Object.assign(new Error('none'), { name: 'AbortError' })),
    [incident?.incident_id, incident?.has_snapshot],
  )

  useEffect(() => {
    setReviewed(false); setClipState('idle')
    setClipUrl((old) => { if (old) URL.revokeObjectURL(old); return null })
  }, [incident?.incident_id])

  useEffect(() => () => { if (clipUrl) URL.revokeObjectURL(clipUrl) }, [clipUrl])

  if (!incident) return null
  const active = incident.state !== 'INCIDENT_RESOLVED'

  async function loadClip() {
    setClipState('loading')
    try {
      const blob = await api.getIncidentClip(incident.incident_id)
      setClipUrl(URL.createObjectURL(blob))
      setClipState('ready')
    } catch (e) {
      setClipState(e.status === 404 ? 'missing' : 'error')
    }
  }

  function downloadClip() {
    if (!clipUrl) return
    const a = document.createElement('a')
    a.href = clipUrl
    a.download = `${incident.incident_id}_evidence.mp4`
    document.body.appendChild(a); a.click(); a.remove()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 h-full w-full sm:w-[420px] z-50 bg-slate-950 border-l border-slate-800 overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Incident notification</p>
            <h2 className="text-2xl font-bold mt-1">Alert details</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-slate-700 px-2.5 py-1 text-slate-300 hover:bg-slate-800">✕</button>
        </div>

        <div className={`rounded-lg border p-3 ${active ? 'border-red-700 bg-red-950/40' : 'border-slate-700 bg-slate-900/60'}`}>
          <div className={`text-sm font-bold ${active ? 'text-red-300' : 'text-slate-300'}`}>
            {active ? '⚠ SUSPICIOUS ACTIVITY DETECTED' : 'INCIDENT RESOLVED'}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {incident.description || 'Suspicious movement requires review.'}
          </p>
        </div>

        <div className="flex gap-2">
          <span className={`rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            active ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-slate-800 text-slate-400 border border-slate-700'
          }`}>
            {reviewed ? 'Reviewed' : active ? 'Live alert' : 'Resolved'}
          </span>
          <span className="rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide bg-teal-950 text-teal-300 border border-teal-800">
            {incident.location}
          </span>
        </div>

        <div className="rounded-lg border border-slate-800 divide-y divide-slate-800 text-sm">
          {[
            ['Incident ID', incident.incident_id],
            ['Detected at', incident.started_at ? new Date(incident.started_at).toLocaleString() : '—'],
            ['People detected', (incident.people_involved || []).length],
            ['Camera', incident.source_id],
            ['Peak movement', `${Math.round(incident.peak_movement || 0)} px`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3 py-2.5 bg-slate-900/50">
              <span className="text-slate-400 text-xs">{label}</span>
              <span className="font-medium text-slate-100 text-xs text-right">{value}</span>
            </div>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Incident snapshot</h3>
            <span className="text-[11px] text-slate-500">Saved evidence</span>
          </div>
          {incident.has_snapshot ? (
            snapshotUrl
              ? <img src={snapshotUrl} alt="Incident snapshot" className="w-full rounded-lg border border-slate-800" />
              : <div className="w-full aspect-video rounded-lg bg-slate-900 animate-pulse" />
          ) : <p className="text-xs text-slate-500">No snapshot was saved for this incident.</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Evidence clip</h3>
            <span className="text-[11px] text-slate-500">±10 s around the alert</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadClip}
              disabled={clipState === 'loading'}
              className="flex-1 rounded-md border border-slate-600 px-3 py-2 text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
            >
              {clipState === 'loading' ? 'Loading evidence…' : 'View evidence clip'}
            </button>
            {clipState === 'ready' && (
              <button
                onClick={downloadClip}
                className="flex-1 rounded-md bg-cyan-500 text-slate-950 px-3 py-2 text-xs font-semibold hover:bg-cyan-400"
              >
                Download evidence
              </button>
            )}
          </div>
          {clipState === 'missing' && (
            <p className="text-[11px] text-amber-300">Evidence clip is not ready yet — it finishes ~10 s after the alert.</p>
          )}
          {clipState === 'error' && <p className="text-[11px] text-red-300">Could not load the evidence clip.</p>}
          {clipUrl && <video controls autoPlay muted src={clipUrl} className="w-full rounded-lg border border-slate-800" />}
        </div>

        <p className="text-[11px] text-slate-500">Closing this panel does not remove the incident from history.</p>

        <div className="space-y-2 pb-4">
          <button
            onClick={() => { onViewHistory(incident.source_id); onClose() }}
            className="w-full rounded-lg bg-teal-500 text-slate-950 font-semibold py-2.5 text-sm hover:bg-teal-400"
          >
            View camera history
          </button>
          <button
            onClick={() => setReviewed(true)}
            disabled={reviewed}
            className="w-full rounded-lg border border-slate-700 py-2.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {reviewed ? 'Marked as reviewed' : 'Mark as reviewed'}
          </button>
        </div>
      </aside>
    </>
  )
}