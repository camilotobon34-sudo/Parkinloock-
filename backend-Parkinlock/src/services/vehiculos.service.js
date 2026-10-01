import { query, transaction } from '../config/db.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import { fechaLocal } from '../utils/fechas.js'
import { placaValida } from '../utils/placa.js'
import { id, paginacion } from '../utils/validar.js'
import { obtener as obtenerCliente } from './clientes.service.js'

const SELECT_VEHICULO = `
  SELECT v.id_vehiculo, v.placa, v.id_tipo_vehiculo, tv.nombre AS tipo, v.id_cliente, c.nombre AS cliente
    FROM vehiculos v
    JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
    LEFT JOIN clientes c   ON c.id_cliente = v.id_cliente`

export const tipos = () => query(`SELECT id_tipo_vehiculo, nombre FROM tipos_vehiculo ORDER BY id_tipo_vehiculo`)

/** Acepta { tipo: 'CARRO' | 'MOTO' } o { id_tipo_vehiculo }. */
export async function resolverTipo({ tipo, id_tipo_vehiculo } = {}, conn) {
  if (id_tipo_vehiculo !== undefined && id_tipo_vehiculo !== null && id_tipo_vehiculo !== '') {
    const [t] = await query(`SELECT id_tipo_vehiculo, nombre FROM tipos_vehiculo WHERE id_tipo_vehiculo = ?`, [id(id_tipo_vehiculo, 'id_tipo_vehiculo')], conn)
    if (!t) throw badRequest('El tipo de vehículo no existe.')
    return t
  }
  if (tipo) {
    const [t] = await query(`SELECT id_tipo_vehiculo, nombre FROM tipos_vehiculo WHERE nombre = ?`, [String(tipo).trim().toUpperCase()], conn)
    if (!t) throw badRequest('El tipo de vehículo no existe.')
    return t
  }
  return null
}

export async function porPlaca(placa, conn, { bloquear = false } = {}) {
  const [v] = await query(`${SELECT_VEHICULO} WHERE v.placa = ? ${bloquear ? 'FOR UPDATE OF v' : ''}`, [placaValida(placa)], conn)
  return v ?? null
}

export async function porId(idVehiculo, conn) {
  const [v] = await query(`${SELECT_VEHICULO} WHERE v.id_vehiculo = ?`, [id(idVehiculo, 'id_vehiculo')], conn)
  if (!v) throw notFound('El vehículo no existe.')
  return v
}

/**
 * Devuelve el vehículo de la placa o lo registra si no existe (requiere tipo).
 * Si se envía un tipo distinto al registrado, rechaza la operación.
 */
export async function obtenerORegistrar(conn, { placa, tipo, id_tipo_vehiculo, id_cliente }) {
  const p = placaValida(placa)
  const tipoPedido = await resolverTipo({ tipo, id_tipo_vehiculo }, conn)
  const existente = await porPlaca(p, conn, { bloquear: true })
  if (existente) {
    if (tipoPedido && tipoPedido.id_tipo_vehiculo !== existente.id_tipo_vehiculo) {
      throw conflict(`La placa ${p} está registrada como ${existente.tipo}.`)
    }
    return existente
  }
  if (!tipoPedido) throw notFound(`El vehículo ${p} no está registrado. Indique el tipo de vehículo para registrarlo.`)
  const r = await query(
    `INSERT INTO vehiculos (placa, id_tipo_vehiculo, id_cliente) VALUES (?, ?, ?)`,
    [p, tipoPedido.id_tipo_vehiculo, id_cliente ?? null],
    conn,
  )
  return porId(r.insertId, conn)
}

/** Asocia el cliente al vehículo si no tiene; rechaza si la placa pertenece a otro cliente. */
export async function asegurarCliente(conn, vehiculo, idCliente) {
  if (vehiculo.id_cliente === idCliente) return
  if (vehiculo.id_cliente !== null) throw conflict(`La placa ${vehiculo.placa} pertenece a otro cliente.`)
  await query(`UPDATE vehiculos SET id_cliente = ? WHERE id_vehiculo = ?`, [idCliente, vehiculo.id_vehiculo], conn)
}

export async function registrar(body = {}) {
  return transaction(async (conn) => {
    const tipo = await resolverTipo(body, conn)
    if (!tipo) throw badRequest('El tipo de vehículo es obligatorio.')
    const idCliente = body.id_cliente ? (await obtenerCliente(body.id_cliente, conn)).id_cliente : null
    const p = placaValida(body.placa)
    if (await porPlaca(p, conn)) throw conflict(`La placa ${p} ya está registrada.`)
    const r = await query(`INSERT INTO vehiculos (placa, id_tipo_vehiculo, id_cliente) VALUES (?, ?, ?)`, [p, tipo.id_tipo_vehiculo, idCliente], conn)
    return porId(r.insertId, conn)
  })
}

/** RF-009: datos del vehículo, entrada abierta y mensualidad vigente hoy. */
export async function buscarPorPlaca(placa) {
  const v = await porPlaca(placa)
  if (!v) throw notFound(`No hay un vehículo registrado con la placa ${placaValida(placa)}.`)
  const [movimiento] = await query(
    `SELECT m.id_movimiento, m.fecha_hora_entrada, e.codigo AS espacio
       FROM movimientos m JOIN espacios e ON e.id_espacio = m.id_espacio
      WHERE m.id_vehiculo = ? AND m.estado = 'EN_PARQUEADERO'`,
    [v.id_vehiculo],
  )
  const hoy = fechaLocal()
  const [mensualidad] = await query(
    `SELECT id_mensualidad, fecha_inicio, fecha_fin FROM mensualidades
      WHERE id_vehiculo = ? AND ? BETWEEN fecha_inicio AND fecha_fin ORDER BY fecha_fin DESC LIMIT 1`,
    [v.id_vehiculo, hoy],
  )
  return { ...v, en_parqueadero: Boolean(movimiento), movimiento_abierto: movimiento ?? null, mensualidad_vigente: mensualidad ?? null }
}

export function listar(q = {}) {
  const { limit, offset } = paginacion(q)
  const placa = q.placa ? String(q.placa).replace(/[\s-]+/g, '').toUpperCase() : null
  return query(
    `${SELECT_VEHICULO} ${placa ? 'WHERE v.placa LIKE ?' : ''} ORDER BY v.placa LIMIT ? OFFSET ?`,
    placa ? [`%${placa}%`, limit, offset] : [limit, offset],
  )
}

export async function actualizar(idVehiculo, body = {}) {
  return transaction(async (conn) => {
    const actual = await porId(idVehiculo, conn)
    const placa = body.placa !== undefined ? placaValida(body.placa) : actual.placa
    const tipo = (await resolverTipo(body, conn)) ?? { id_tipo_vehiculo: actual.id_tipo_vehiculo }
    let idCliente = actual.id_cliente
    if (body.id_cliente !== undefined) idCliente = body.id_cliente === null ? null : (await obtenerCliente(body.id_cliente, conn)).id_cliente

    if (tipo.id_tipo_vehiculo !== actual.id_tipo_vehiculo) {
      const [abierto] = await query(`SELECT 1 FROM movimientos WHERE id_vehiculo = ? AND estado = 'EN_PARQUEADERO'`, [actual.id_vehiculo], conn)
      if (abierto) throw conflict('No se puede cambiar el tipo de un vehículo que está dentro del parqueadero.')
    }
    if (placa !== actual.placa && (await porPlaca(placa, conn))) throw conflict(`La placa ${placa} ya está registrada.`)
    await query(
      `UPDATE vehiculos SET placa = ?, id_tipo_vehiculo = ?, id_cliente = ? WHERE id_vehiculo = ?`,
      [placa, tipo.id_tipo_vehiculo, idCliente, actual.id_vehiculo],
      conn,
    )
    return porId(actual.id_vehiculo, conn)
  })
}
