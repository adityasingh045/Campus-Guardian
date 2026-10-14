import { useEffect, useState, useCallback } from 'react'
import { api } from '../utils/api'

export function useSources(pollIntervalMs = 5000) {
  const [sources, setSources] = useState([])
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.listSources()
      setSources(data.sources)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, pollIntervalMs)
    return () => clearInterval(id)
  }, [refresh, pollIntervalMs])

  return { sources, error, refresh }
}
