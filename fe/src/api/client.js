export const API_URL = String(globalThis.__API_URL__ ?? import.meta.env?.VITE_API_URL ?? '').replace(/\/$/, '')

export const API_MODE = API_URL ? 'http' : 'mock'

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const failRate = 0.12

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

let unauthorizedHandler = () => {}

export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn
}

export const http = async (method, path, body) => {
  let response
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: { 'X-Requested-With': 'live-monitor', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError('Server tidak dapat dihubungi.', 'NETWORK', 0)
  }
  const data = await response.json().catch(() => null)
  if (response.status === 401 && !path.startsWith('/auth/')) unauthorizedHandler()
  if (!response.ok) throw new ApiError(data?.error?.message || `Permintaan gagal (${response.status}).`, data?.error?.code || 'HTTP_ERROR', response.status)
  return data
}
