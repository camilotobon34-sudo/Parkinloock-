import { diasEntre, esFechaValida } from './fechas.js'

export const DIAS_POR_VENCER = 5
const pad = (n) => String(n).padStart(2, '0')

/**
 * RC-07: un mes desde la fecha de inicio. Termina el día anterior al mismo día del
 * mes siguiente; si ese día no existe en el mes siguiente, termina el último día de ese mes.
 */
export function calcularFechaFin(fechaInicio) {
  if (!esFechaValida(fechaInicio)) throw new RangeError('Fecha de inicio no válida.')
  const [y, m, d] = fechaInicio.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  const diasMesSiguiente = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  if (d > diasMesSiguiente) return `${ny}-${pad(nm)}-${pad(diasMesSiguiente)}`
  const fin = new Date(Date.UTC(ny, nm - 1, d - 1))
  return `${fin.getUTCFullYear()}-${pad(fin.getUTCMonth() + 1)}-${pad(fin.getUTCDate())}`
}

/** RC-10: VENCIDA después de la fecha de fin; POR VENCER si faltan 5 días o menos. */
export function estadoMensualidad(fechaFin, hoy) {
  const dias = diasEntre(hoy, fechaFin)
  if (dias < 0) return 'VENCIDA'
  if (dias <= DIAS_POR_VENCER) return 'POR VENCER'
  return 'ACTIVA'
}
