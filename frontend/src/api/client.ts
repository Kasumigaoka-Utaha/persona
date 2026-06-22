const DEFAULT_API_BASE = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : 'https://persona-production-efaf.up.railway.app/api'

function normalizeApiBase(value: string | undefined) {
  const raw = (value || DEFAULT_API_BASE).trim().replace(/\/+$/, '')
  if (raw.startsWith('/')) {
    return raw
  }
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.endsWith('/api') ? withProtocol : `${withProtocol}/api`
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL)

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export { API_BASE, request }
