import { query } from '../config/db.js'
import { forbidden, notFound } from '../utils/errors.js'
import { calcularCambio } from '../utils/pago.js'
import { fecha, id, monto, paginacion } from '../utils/validar.js'
import { ahora } from '../utils/fechas.js'

/**
 * Registra un pago en efectivo (RC-08) asociado a una sola operación:
 * { id_movimiento } | { id_reserva } | { id_mensualidad }.
 */
export async function registrar(conn, { origen, idTurno, valor, efectivoRecibido }) {
  const efectivo = monto(efectivoRecibido, 'efectivo_recibido')
  const cambio = calcularCambio(valor, efectivo)
  const r = await query(
    `INSERT INTO pagos (id_movimiento, id_reserva, id_mensualidad, id_turno, valor, efectivo_recibido, cambio, fecha_hora)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [origen.id_movimiento ?? null, origen.id_reserva ?? null, origen.id_mensualidad ?? null, idTurno, valor, efectivo, cambio, ahora()],
    conn,
  )
  return { id_pago: r.insertId, metodo: 'EFECTIVO', valor, efectivo_recibido: efectivo, cambio }
}

export function calcularCambioVista(body = {}) {
  const valor = monto(body.valor, 'valor')
  const efectivo = monto(body.efectivo_recibido, 'efectivo_recibido')
  if (efectivo < valor) {
    return { valor, efectivo_recibido: efectivo, suficiente: false, faltante: Math.round((valor - efectivo) * 100) / 100, cambio: null }
  }
  return { valor, efectivo_recibido: efectivo, suficiente: true, faltante: 0, cambio: calcularCambio(valor, efectivo) }
}

const SELECT_PAGO = `
  SELECT p.id_pago, p.id_movimiento, p.id_reserva, p.id_mensualidad, p.id_turno, p.metodo, p.valor,
         p.efectivo_recibido, p.cambio, p.fecha_hora, t.id_usuario, u.nombre_completo AS trabajador,
         CASE WHEN p.id_movimiento IS NOT NULL THEN 'SALIDA'
              WHEN p.id_reserva IS NOT NULL THEN 'RESERVA' ELSE 'MENSUALIDAD' END AS concepto
    FROM pagos p
    JOIN turnos t   ON t.id_turno = p.id_turno
    JOIN usuarios u ON u.id_usuario = t.id_usuario`

export async function obtener(actor, idPago) {
  const [p] = await query(`${SELECT_PAGO} WHERE p.id_pago = ?`, [id(idPago, 'id_pago')])
  if (!p) throw notFound('El pago no existe.')
  if (actor.rol !== 'ADMINISTRADOR' && p.id_usuario !== actor.id_usuario) throw forbidden('Solo puede consultar los pagos de sus turnos.')
  return p
}

export function listar(q = {}) {
  const { limit, offset } = paginacion(q)
  const dia = fecha(q.fecha, 'fecha', { requerido: false })
  return query(
    `${SELECT_PAGO} ${dia ? 'WHERE DATE(p.fecha_hora) = ?' : ''} ORDER BY p.fecha_hora DESC LIMIT ? OFFSET ?`,
    dia ? [dia, limit, offset] : [limit, offset],
  )
}
