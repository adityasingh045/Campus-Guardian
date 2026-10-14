import { useEffect, useRef, useState, useCallback } from 'react'
import { API_KEY } from '../utils/api'

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`

/** One authenticated socket receives frames and incident events for all sources. */
export function useWebSocket() {
  const [framesBySource, setFramesBySource] = useState({})
  const [latestIncidentEvent, setLatestIncidentEvent] = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const backoffRef = useRef(1000)
  const stoppedRef = useRef(false)
  const reconnectTimerRef = useRef(null)

  const connect = useCallback(() => {
    if (stoppedRef.current) return

    const url = `${WS_URL}${WS_URL.includes('?') ? '&' : '?'}key=${encodeURIComponent(API_KEY)}`
    let ws
    try {
      ws = new WebSocket(url)
    } catch (error) {
      console.error('Unable to create Campus Guardian WebSocket:', error)
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      if (wsRef.current !== ws) return
      setConnected(true)
      backoffRef.current = 1000
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'frame' && msg.source_id && typeof msg.frame === 'string') {
          setFramesBySource((prev) => ({
            ...prev,
            [msg.source_id]: { frame: msg.frame, stats: msg.stats, ts: msg.ts },
          }))
        } else if (msg.type === 'incident' && msg.incident_id) {
          setLatestIncidentEvent(msg)
        }
      } catch {
        // Ignore malformed or non-JSON messages without breaking the stream.
      }
    }

    ws.onclose = (event) => {
      if (wsRef.current === ws) {
        wsRef.current = null
        setConnected(false)
      }
      if (event.code === 4401) {
        console.error('WebSocket authentication failed. Check the dashboard/API authentication configuration.')
        return
      }
      if (!stoppedRef.current) scheduleReconnect()
    }

    ws.onerror = () => ws.close()
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current || reconnectTimerRef.current) return
    const delay = Math.min(backoffRef.current, 30000)
    backoffRef.current = Math.min(backoffRef.current * 2, 30000)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      connect()
    }, delay)
  }, [connect])

  useEffect(() => {
    stoppedRef.current = false
    connect()
    return () => {
      stoppedRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
      const ws = wsRef.current
      wsRef.current = null
      ws?.close()
    }
  }, [connect])

  return { framesBySource, latestIncidentEvent, connected }
}
