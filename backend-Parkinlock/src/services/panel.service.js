import { query } from '../config/db.js'
import { fechaLocal } from '../utils/fechas.js'
import { turnoActivo } from './turnos.service.js'

/** RF-005, RF-007 y RF-021: indicadores del día, últimos movimientos y turno activo. */
export async function resumen(actor) {
  const hoy = fechaLocal()
  const [ind] = await query(
    `SELECT
       (SELECT COUNT(*) FROM movimientos WHERE estado = 'EN_PARQUEADERO') AS vehiculos_dentro,
       (SELECT COUNT(*) FROM espacios)                                    AS total_espacios,
       (SELECT COUNT(*) FROM espacios WHERE estado = 'DISPONIBLE')        AS disponibles,
       (SELECT COUNT(*) FROM espacios WHERE estado = 'OCUPADO')           AS ocupados,
       (SELECT COUNT(*) FROM espacios WHERE estado = 'RESERVADO')         AS reservados,
       (SELECT COALESCE(SUM(valor), 0) FROM pagos WHERE DATE(fecha_hora) = ?) AS recaudado_hoy`,
    [hoy],
  )
  const ocupacion = ind.total_espacios ? Math.round(((ind.ocupados + ind.reservados) / ind.total_espacios) * 100) : 0
  const ultimos = await query(
    `SELECT m.id_movimiento, v.placa, e.codigo AS espacio, m.fecha_hora_entrada, m.fecha_hora_salida, m.estado, m.valor_total
       FROM movimientos m
       JOIN vehiculos v ON v.id_vehiculo = m.id_vehiculo
       JOIN espacios e  ON e.id_espacio = m.id_espacio
      ORDER BY GREATEST(m.fecha_hora_entrada, COALESCE(m.fecha_hora_salida, m.fecha_hora_entrada)) DESC
      LIMIT 5`,
  )
  return { fecha: hoy, indicadores: { ...ind, ocupacion_porcentaje: ocupacion }, ultimos_movimientos: ultimos, turno_activo: await turnoActivo(actor.id_usuario) }
}
