const pad = (n) => String(n).padStart(2, '0')

/** Fecha y hora actual sin milisegundos (DATETIME guarda segundos). */
export function ahora() {
  const d = new Date()
  d.setMilliseconds(0)
  return d
}

/** 'YYYY-MM-DD' en la zona horaria del proceso. */
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'HH:MM:SS' en la zona horaria del proceso. */
export function horaLocal(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function esFechaValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** Acepta 'HH:MM' o 'HH:MM:SS' y devuelve 'HH:MM:SS', o null si no es válida. */
export function normalizarHora(s) {
  if (typeof s !== 'string') return null
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  const [h, min, seg = 0] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)]
  if (h > 23 || min > 59 || seg > 59) return null
  return `${pad(h)}:${pad(min)}:${pad(seg)}`
}

/** Días calendario de a hasta b (ambas 'YYYY-MM-DD'). */
export function diasEntre(a, b) {
  const toUTC = (s) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUTC(b) - toUTC(a)) / 86400000)
}

/** Interpreta 'YYYY-MM-DD HH:MM[:SS]' o ISO como fecha local. */
export function parsearFechaHora(s) {
  if (s instanceof Date) return s
  if (typeof s !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s)
  if (!m) return null
  const [y, mo, d, h, mi, se] = m.slice(1).map((v) => Number(v ?? 0))
  const dt = new Date(y, mo - 1, d, h, mi, se)
  return dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null
}
