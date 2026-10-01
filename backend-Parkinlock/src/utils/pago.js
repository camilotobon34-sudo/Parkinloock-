import { badRequest } from './errors.js'

const pesos = (n) => `$${Math.round(n).toLocaleString('es-CO')}`
const redondear = (n) => Math.round(n * 100) / 100

/** RC-08: cambio = efectivo recibido − valor; lanza 400 con el faltante si no alcanza. */
export function calcularCambio(valor, efectivoRecibido) {
  if (!Number.isFinite(valor) || valor < 0) throw badRequest('El valor a pagar no es válido.')
  if (!Number.isFinite(efectivoRecibido) || efectivoRecibido < 0) {
    throw badRequest('El efectivo recibido no puede ser negativo.')
  }
  if (efectivoRecibido < valor) {
    const faltante = redondear(valor - efectivoRecibido)
    throw badRequest(`Con ${pesos(efectivoRecibido)}, faltan ${pesos(faltante)} para completar.`, { faltante })
  }
  return redondear(efectivoRecibido - valor)
}
