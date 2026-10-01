import { query, transaction } from '../config/db.js'
import { badRequest, conflict, forbidden, notFound } from '../utils/errors.js'
import { parsearFechaHora } from '../utils/fechas.js'
import { id, monto, texto } from '../utils/validar.js'

const COLUMNAS = `t.id_turno, t.id_usuario, u.nombre_completo AS usuario, t.caja, t.inicio_programado,
  t.fin_programado, t.caja_inicial, t.estado`

export async function turnoActivo(idUsuario, conn) {
  const [t] = await query(
    `SELECT ${COLUMNAS} FROM turnos t JOIN usuarios u ON u.id_usuario = t.id_usuario
      WHERE t.id_usuario = ? AND t.estado = 'ABIERTO' ORDER BY t.id_turno DESC LIMIT 1`,
    [idUsuario],
    conn,
  )
  return t ?? null
}

/** Los cobros quedan asociados al turno: sin turno abierto no se registran entradas, salidas ni pagos. */
export async function exigirTurnoActivo(idUsuario, conn) {
  const t = await turnoActivo(idUsuario, conn)
  if (!t) throw conflict('Debe abrir un turno antes de registrar operaciones.')
  return t
}

export async function abrir(actor, body = {}) {
  const idUsuario = actor.rol === 'ADMINISTRADOR' && body.id_usuario ? id(body.id_usuario, 'id_usuario') : actor.id_usuario
  const caja = texto(body.caja, 'caja', { max: 20 })
  const inicio = parsearFechaHora(body.inicio_programado)
  const fin = parsearFechaHora(body.fin_programado)
  if (!inicio || !fin) throw badRequest('inicio_programado y fin_programado deben tener el formato AAAA-MM-DD HH:MM.')
  if (fin <= inicio) throw badRequest('El fin del turno debe ser posterior al inicio.')
  const cajaInicial = monto(body.caja_inicial ?? 0, 'caja_inicial')

  return transaction(async (conn) => {
    const [u] = await query(`SELECT id_usuario, estado FROM usuarios WHERE id_usuario = ? FOR UPDATE`, [idUsuario], conn)
    if (!u) throw notFound('El usuario no existe.')
    if (u.estado !== 'ACTIVO') throw conflict('El usuario está inactivo.')
    if (await turnoActivo(idUsuario, conn)) throw conflict('El usuario ya tiene un turno abierto.')
    const r = await query(
      `INSERT INTO turnos (id_usuario, caja, inicio_programado, fin_programado, caja_inicial) VALUES (?, ?, ?, ?, ?)`,
      [idUsuario, caja, inicio, fin, cajaInicial],
      conn,
    )
    const [t] = await query(`SELECT ${COLUMNAS} FROM turnos t JOIN usuarios u ON u.id_usuario = t.id_usuario WHERE t.id_turno = ?`, [r.insertId], conn)
    return t
  })
}

export async function cerrar(actor, idTurno) {
  const turnoId = id(idTurno, 'id_turno')
  return transaction(async (conn) => {
    const [t] = await query(`SELECT * FROM turnos WHERE id_turno = ? FOR UPDATE`, [turnoId], conn)
    if (!t) throw notFound('El turno no existe.')
    if (actor.rol !== 'ADMINISTRADOR' && t.id_usuario !== actor.id_usuario) throw forbidden('Solo puede cerrar su propio turno.')
    if (t.estado !== 'ABIERTO') throw conflict('El turno ya está cerrado.')
    await query(`UPDATE turnos SET estado = 'CERRADO' WHERE id_turno = ?`, [turnoId], conn)
    const [r] = await query(
      `SELECT COUNT(*) AS pagos, COALESCE(SUM(valor), 0) AS recaudado FROM pagos WHERE id_turno = ?`,
      [turnoId],
      conn,
    )
    return { id_turno: turnoId, estado: 'CERRADO', caja_inicial: t.caja_inicial, pagos: r.pagos, recaudado: r.recaudado }
  })
}

export function listar({ estado } = {}) {
  const filtro = estado ? `WHERE t.estado = ?` : ''
  return query(
    `SELECT ${COLUMNAS} FROM turnos t JOIN usuarios u ON u.id_usuario = t.id_usuario ${filtro} ORDER BY t.id_turno DESC LIMIT 200`,
    estado ? [String(estado).toUpperCase()] : [],
  )
}
