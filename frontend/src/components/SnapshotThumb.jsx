import { useEffect, useState } from 'react'
import { api } from '../utils/api.js'

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString()
}

/* Lazy-loading evidence snapshot card, reused by the History page and the
   per-camera history drawer. */
export default function SnapshotThumb({ incident, onOpen }) {
  const [url, setUrl] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl
    const controller = new AbortController()
    api
      .getIncidentSnapshot(incident.incident_id, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setFailed(true)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [incident.incident_id])

  if (failed) return null
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
      {url ? (
        <img src={url} alt={`Snapshot ${incident.incident_id}`} className="aspect-video w-full object-cover" />
      ) : (
        <div className="aspect-video w-full animate-pulse bg-slate-900" />
      )}
      <div className="space-y-1 p-3">
        <div className="text-xs font-medium text-slate-200">{incident.incident_id}</div>
        <div className="text-[11px] text-slate-500">{formatDateTime(incident.started_at)}</div>
        <button onClick={() => onOpen(incident)} className="text-[11px] text-cyan-400 hover:text-cyan-300">
          View snapshot ↗
        </button>
      </div>
    </div>
  )
}