import { useState } from 'react'
import { api } from '../utils/api.js'

function makeId() {
  return `PHONE-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
}

export default function PhoneCameraManager({ onAdded }) {
  const [location, setLocation] = useState('College Main Gate')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [links, setLinks] = useState([])

  async function addPhone() {
    setBusy(true); setError('')
    const sourceId = makeId()
    try {
      await api.registerPhoneCamera({ source_id: sourceId, location: location.trim() || 'Phone camera' })
      const url = `${window.location.origin}/phone-camera?source=${encodeURIComponent(sourceId)}&location=${encodeURIComponent(location.trim() || 'Phone camera')}`
      setLinks((old) => [{ sourceId, location: location.trim() || 'Phone camera', url }, ...old])
      onAdded?.()
    } catch (e) { setError(e.message || 'Could not register phone camera.') }
    finally { setBusy(false) }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text) } catch { setError('Copy was blocked by the browser. Select and copy the camera link manually.') }
  }

  return <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
    <div><h2 className="font-semibold">Phone cameras</h2><p className="text-xs text-slate-400 mt-1">Connect multiple iPhones or Android phones as independent live sources. No Mac webcam is used.</p></div>
    <div className="flex flex-col sm:flex-row gap-2"><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Camera location (e.g. Hostel Block A)" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/><button onClick={addPhone} disabled={busy} className="rounded-lg bg-cyan-500 text-slate-950 font-semibold px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Adding…' : '+ Add phone camera'}</button></div>
    {error && <p className="text-xs text-red-300">{error}</p>}
    {links.map((item) => <div key={item.sourceId} className="rounded-lg border border-slate-800 p-3 space-y-2"><div className="text-sm font-medium">{item.location} <span className="text-xs text-slate-500">· {item.sourceId}</span></div><p className="text-xs text-slate-400 break-all">{item.url}</p><div className="flex gap-2"><button onClick={() => copy(item.url)} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs">Copy phone link</button><button onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')} className="rounded-md border border-slate-700 px-3 py-1.5 text-xs">Open on this device</button></div><p className="text-xs text-amber-300">For another phone, open this link using the dashboard's LAN address (not localhost).</p></div>)}
  </section>
}
