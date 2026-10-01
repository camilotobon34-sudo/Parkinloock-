import { query } from '../config/db.js'
import { conflict, notFound } from '../utils/errors.js'
import { id } from '../utils/validar.js'

/** RF-020: alertas operativas activas. */
export function activas() {
  return query(
    `SELECT a.id_alerta, a.tipo, a.mensaje, a.id_reserva, a.fecha_hora, a.estado
       FROM alertas a WHERE a.estado = 'ACTIVA' ORDER BY a.fecha_hora DESC`,
  )
}

export async function atender(idAlerta) {
  const alertaId = id(idAlerta, 'id_alerta')
  const [a] = await query(`SELECT estado FROM alertas WHERE id_alerta = ?`, [alertaId])
  if (!a) throw notFound('La alerta no existe.')
  if (a.estado === 'ATENDIDA') throw conflict('La alerta ya fue atendida.')
  await query(`UPDATE alertas SET estado = 'ATENDIDA' WHERE id_alerta = ?`, [alertaId])
  return { id_alerta: alertaId, estado: 'ATENDIDA' }
}
