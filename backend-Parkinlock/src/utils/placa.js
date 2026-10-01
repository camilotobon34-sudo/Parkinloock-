import { badRequest } from './errors.js'

/** "abc 123" → "ABC123". Quita espacios y guiones y pasa a mayúsculas. */
export function normalizarPlaca(placa) {
  if (typeof placa !== 'string') return ''
  return placa.replace(/[\s-]+/g, '').toUpperCase()
}

/** Normaliza y valida; lanza 400 si la placa queda vacía o tiene caracteres no válidos. */
export function placaValida(placa) {
  const p = normalizarPlaca(placa)
  if (!p) throw badRequest('La placa es obligatoria.')
  if (!/^[A-Z0-9]{3,10}$/.test(p)) {
    throw badRequest('La placa solo puede tener letras y números (entre 3 y 10 caracteres).')
  }
  return p
}
