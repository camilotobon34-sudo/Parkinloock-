import { badRequest } from './errors.js'
import { esFechaValida, normalizarHora } from './fechas.js'

export function texto(valor, campo, { requerido = true, max = 255, min = 1 } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw badRequest(`El campo ${campo} es obligatorio.`)
    return null
  }
  if (typeof valor !== 'string') throw badRequest(`El campo ${campo} debe ser texto.`)
  const v = valor.trim()
  if (v.length < min) throw badRequest(`El campo ${campo} es obligatorio.`)
  if (v.length > max) throw badRequest(`El campo ${campo} admite máximo ${max} caracteres.`)
  return v
}

export function id(valor, campo = 'id', { requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw badRequest(`El campo ${campo} es obligatorio.`)
    return null
  }
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`El campo ${campo} no es válido.`)
  return n
}

/** Monto en pesos: número finito, no negativo, con máximo 2 decimales. */
export function monto(valor, campo, { requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw badRequest(`El campo ${campo} es obligatorio.`)
    return null
  }
  const n = typeof valor === 'string' ? Number(valor.trim()) : valor
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest(`El campo ${campo} debe ser un número.`)
  if (n < 0) throw badRequest(`El campo ${campo} no puede ser negativo.`)
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw badRequest(`El campo ${campo} admite máximo 2 decimales.`)
  return n
}

export function fecha(valor, campo, { requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw badRequest(`El campo ${campo} es obligatorio.`)
    return null
  }
  if (!esFechaValida(valor)) throw badRequest(`El campo ${campo} debe tener el formato AAAA-MM-DD.`)
  return valor
}

export function hora(valor, campo) {
  const h = normalizarHora(valor)
  if (!h) throw badRequest(`El campo ${campo} debe tener el formato HH:MM.`)
  return h
}

export function opcion(valor, campo, opciones, { requerido = true } = {}) {
  if (valor === undefined || valor === null || valor === '') {
    if (requerido) throw badRequest(`El campo ${campo} es obligatorio.`)
    return null
  }
  const v = String(valor).trim().toUpperCase()
  if (!opciones.includes(v)) throw badRequest(`El campo ${campo} debe ser uno de: ${opciones.join(', ')}.`)
  return v
}

export function paginacion(q = {}) {
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200)
  const offset = Math.max(Number(q.offset) || 0, 0)
  return { limit, offset }
}
