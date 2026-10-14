const API_BASE  = import.meta.env.VITE_API_BASE_URL || ''
const API_KEY = import.meta.env.VITE_API_KEY || ''

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return res
}

export const api = {
  health: () => request('/api/health'),

  listSources: () => request('/api/sources'),
  getSource: (id) => request(`/api/sources/${id}`),
  addSource: (body) => request('/api/sources', { method: 'POST', body: JSON.stringify(body) }),
  registerPhoneCamera: (body) => request('/api/sources/phone', { method: 'POST', body: JSON.stringify(body) }),
  removeSource: (id) => request(`/api/sources/${id}`, { method: 'DELETE' }),

  listIncidents: ({ limit, offset, sourceId, state } = {}) => {
    const params = new URLSearchParams()
    if (limit) params.set('limit', limit)
    if (offset) params.set('offset', offset)
    if (sourceId) params.set('source_id', sourceId)
    if (state) params.set('state', state)
    const qs = params.toString()
    return request(`/api/incidents${qs ? `?${qs}` : ''}`)
  },
  getIncident: (id) => request(`/api/incidents/${id}`),
  getIncidentSnapshot: async (id, signal) => {
    const res = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/snapshot`, {
      headers: { 'X-API-Key': API_KEY },
      signal,
    })
    if (!res.ok) throw new Error(`Snapshot request failed (${res.status})`)
    return res.blob()
  },

}

export { API_BASE, API_KEY }
