import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../utils/api'

/**
 * FIX (spec section 11/17): replaces the single-camera useAlerts hook.
 * Incidents (not per-frame alerts) are the unit shown here, each carrying
 * a full timeline. Live WS "incident" events (timeline_update / alert_sent)
 * merge into the matching incident in place instead of appending a new row
 * per frame.
 */
export function useIncidents(latestIncidentEvent) {
  const [incidents, setIncidents] = useState([])
  const [total, setTotal] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const incidentStatesRef = useRef(new Map())

  const loadInitial = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listIncidents({ limit: 30, offset: 0 })
      setIncidents(data.items)
      incidentStatesRef.current = new Map(data.items.map((item) => [item.incident_id, item.state]))
      setTotal(data.total)
      setActiveCount(data.active_incidents ?? 0)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    try {
      const data = await api.listIncidents({ limit: 30, offset: incidents.length })
      setIncidents((prev) => {
        const seen = new Set(prev.map((item) => item.incident_id))
        const fresh = data.items.filter((item) => !seen.has(item.incident_id))
        for (const item of fresh) incidentStatesRef.current.set(item.incident_id, item.state)
        return [...prev, ...fresh]
      })
      setTotal(data.total)
      setActiveCount(data.active_incidents ?? 0)
    } catch (e) {
      setError(e.message)
    }
  }, [incidents.length])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    if (!latestIncidentEvent) return
    const event = latestIncidentEvent
    const wasState = incidentStatesRef.current.get(event.incident_id)
    const wasActive = Boolean(wasState && wasState !== 'INCIDENT_RESOLVED')
    const isActive = Boolean(event.state && event.state !== 'INCIDENT_RESOLVED')
    if (wasState === undefined) {
      setTotal((count) => count + 1)
      if (isActive) setActiveCount((count) => count + 1)
    } else if (wasActive !== isActive) {
      setActiveCount((count) => Math.max(0, count + (isActive ? 1 : -1)))
    }
    incidentStatesRef.current.set(event.incident_id, event.state)

    setIncidents((prev) => {
      const idx = prev.findIndex((item) => item.incident_id === event.incident_id)
      const previous = idx >= 0 ? prev[idx] : null
      const merged = {
        incident_id: event.incident_id,
        source_id: event.source_id,
        location: event.location,
        state: event.state,
        people_involved: event.people_involved ?? previous?.people_involved ?? [],
        peak_movement: event.peak_movement ?? previous?.peak_movement ?? 0,
        min_distance: event.min_distance ?? previous?.min_distance ?? null,
        timeline: event.timeline ?? previous?.timeline ?? [],
        started_at: previous?.started_at ?? new Date().toISOString(),
      }
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...previous, ...merged }
        return next
      }
      return [merged, ...prev]
    })
  }, [latestIncidentEvent])

  return { incidents, total, activeCount, loading, error, loadMore, hasMore: incidents.length < total }
}
