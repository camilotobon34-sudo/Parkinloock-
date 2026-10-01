const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '')
const TOKEN_KEY = 'parkinlock_token'

export class ApiError extends Error {
  constructor(status, message, detalles) {
    super(message)
    this.status = status
    this.detalles = detalles
  }
}

let alNoAutorizado = () => {}
export const onNoAutorizado = (fn) => {
  alNoAutorizado = fn
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
export function setToken(token, recordar = true) {
  clearToken()
  ;(recordar ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function conQuery(path, params) {
  if (!params) return path
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

export async function request(method, path, { body, params } = {}) {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(API_URL + conQuery(path, params), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, `No se pudo conectar con el servidor (${API_URL}).`)
  }

  const texto = await res.text()
  let data = null
  if (texto) {
    try {
      data = JSON.parse(texto)
    } catch {
      data = texto
    }
  }
  if (!res.ok) {
    const mensaje = data?.error || `Error ${res.status}`
    if (res.status === 401 && path !== '/auth/login') alNoAutorizado(mensaje)
    throw new ApiError(res.status, mensaje, data?.detalles)
  }
  return data
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body: body ?? {} }),
  put: (path, body) => request('PUT', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
}
