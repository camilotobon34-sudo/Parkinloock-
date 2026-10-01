import { query, transaction } from '../config/db.js'
import { conflict, notFound } from '../utils/errors.js'
import { id } from '../utils/validar.js'

/** RF-006: espacios con su estado y la placa del vehículo que lo ocupa. */
export async function mapa() {
  const espacios = await query(
    `SELECT e.id_espacio, e.codigo, e.nivel, e.estado, tv.nombre AS tipo, v.placa, m.id_movimiento, m.fecha_hora_entrada
       FROM espacios e
       JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = e.id_tipo_vehiculo
       LEFT JOIN movimientos m ON m.id_espacio = e.id_espacio AND m.estado = 'EN_PARQUEADERO'
       LEFT JOIN vehiculos v   ON v.id_vehiculo = m.id_vehiculo
      ORDER BY e.codigo`,
  )
  const resumen = { total: espacios.length, DISPONIBLE: 0, OCUPADO: 0, RESERVADO: 0 }
  for (const e of espacios) resumen[e.estado]++
  return { resumen, espacios }
}

/** Bloquea y devuelve el espacio (por id_espacio o codigo). */
export async function bloquear(conn, { id_espacio, codigo }) {
  const [e] = id_espacio
    ? await query(`SELECT * FROM espacios WHERE id_espacio = ? FOR UPDATE`, [id(id_espacio, 'id_espacio')], conn)
    : await query(`SELECT * FROM espacios WHERE codigo = ? FOR UPDATE`, [String(codigo ?? '').trim().toUpperCase()], conn)
  if (!e) throw notFound('El espacio no existe.')
  return e
}

/**
 * Liberación manual de un espacio sin vehículo (por ejemplo, un espacio RESERVADO).
 * Un espacio con un vehículo dentro solo se libera registrando su salida y cobro.
 */
export async function liberar(idEspacio) {
  return transaction(async (conn) => {
    const e = await bloquear(conn, { id_espacio: idEspacio })
    const [abierto] = await query(
      `SELECT v.placa FROM movimientos m JOIN vehiculos v ON v.id_vehiculo = m.id_vehiculo
        WHERE m.id_espacio = ? AND m.estado = 'EN_PARQUEADERO'`,
      [e.id_espacio],
      conn,
    )
    if (abierto) throw conflict(`El espacio ${e.codigo} está ocupado por ${abierto.placa}; registre su salida.`)
    await query(`UPDATE espacios SET estado = 'DISPONIBLE' WHERE id_espacio = ?`, [e.id_espacio], conn)
    return { id_espacio: e.id_espacio, codigo: e.codigo, estado: 'DISPONIBLE' }
  })
}
