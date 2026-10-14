import { useEffect, useRef, useState } from 'react'
import { API_KEY } from '../utils/api.js'

export default function PhoneCameraPage() {
  const params = new URLSearchParams(window.location.search)
  const sourceId = params.get('source') || ''
  const location = params.get('location') || 'Phone camera'
  const defaultBackend = window.location.origin
  const [backendUrl, setBackendUrl] = useState(params.get('api') || defaultBackend)
  const [cameraFacing, setCameraFacing] = useState('environment')
  const [state, setState] = useState('idle')
  const [message, setMessage] = useState('Tap Start to share this phone camera with Campus Guardian.')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  async function startCamera() {
    if (!sourceId) {
      setState('error'); setMessage('Missing camera source ID. Create a phone camera from the dashboard first.'); return
    }
    try {
      setState('connecting'); setMessage('Requesting camera permission…')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 10, max: 12 } },
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setState('live'); setMessage('Camera active. Sending sampled frames to the detection server.')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', { alpha: false })
      timerRef.current = setInterval(async () => {
        if (busyRef.current || !videoRef.current || videoRef.current.readyState < 2) return
        busyRef.current = true
        try {
          const video = videoRef.current
          canvas.width = Math.min(video.videoWidth || 640, 960)
          canvas.height = Math.round(canvas.width * (video.videoHeight || 480) / (video.videoWidth || 640))
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.62))
          if (!blob) return
          const response = await fetch(`${backendUrl.replace(/\/$/, '')}/api/sources/phone/${encodeURIComponent(sourceId)}/frame`, {
            method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'X-API-Key': API_KEY }, body: blob,
          })
          if (!response.ok) throw new Error(`Server returned ${response.status}. Check server URL, API key and network.`)
          setMessage(`Live · ${new Date().toLocaleTimeString()} · ${canvas.width}×${canvas.height}`)
        } catch (error) {
          setState('error'); setMessage(error.message || 'Unable to send camera frame.');
        } finally { busyRef.current = false }
      }, 180)
    } catch (error) {
      setState('error')
      setMessage(error.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in your browser settings.' : (error.message || 'Could not start the phone camera.'))
    }
  }

  function stopCamera() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setState('idle'); setMessage('Camera stopped. This phone is no longer sending frames.')
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
    <div className="max-w-xl mx-auto space-y-5">
      <div><p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Campus Guardian · Phone Camera</p><h1 className="text-2xl font-bold mt-2">Connect this phone</h1><p className="text-sm text-slate-400 mt-1">{location} · {sourceId || 'No source ID'}</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <video ref={videoRef} muted playsInline className="w-full aspect-video bg-black rounded-lg object-contain" />
        <div className="mt-3 flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${state === 'live' ? 'bg-emerald-400' : state === 'error' ? 'bg-red-400' : 'bg-amber-400'}`} /><span className="text-sm">{state === 'live' ? 'Streaming' : state === 'error' ? 'Needs attention' : state === 'connecting' ? 'Connecting…' : 'Not connected'}</span></div>
        <p className="text-xs text-slate-400 mt-2 break-words">{message}</p>
      </div>
      <label className="block text-sm">Backend address reachable from this phone<input value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="http://192.168.1.10:8000" className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" /></label>
      <label className="block text-sm">Camera<select value={cameraFacing} onChange={(e) => setCameraFacing(e.target.value)} disabled={state === 'live' || state === 'connecting'} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"><option value="environment">Back camera (recommended)</option><option value="user">Front camera</option></select></label>
      <div className="flex gap-3"><button onClick={startCamera} disabled={state === 'live' || state === 'connecting'} className="flex-1 rounded-lg bg-cyan-500 text-slate-950 font-semibold px-4 py-3 disabled:opacity-40">Start camera</button><button onClick={stopCamera} disabled={state !== 'live' && state !== 'error'} className="rounded-lg border border-slate-700 px-4 py-3 disabled:opacity-40">Stop</button></div>
      <p className="text-xs leading-5 text-slate-500">Keep this page open while streaming. Phone and server must be on the same network. Browser camera access normally requires HTTPS, except localhost. Only use this with consent and in accordance with campus privacy rules.</p>
    </div>
  </main>
}
