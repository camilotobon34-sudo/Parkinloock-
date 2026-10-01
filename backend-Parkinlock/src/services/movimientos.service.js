import { query, transaction } from '../config/db.js'
import { calcularCobro } from '../utils/cobro.js'
import { conflict, notFound } from '../utils/errors.js'
import { ahora, fechaLocal } from '../utils/fechas.js'
import { placaValida } from '../utils/placa.js'
import { fecha, id, paginacion } from '../utils/validar.js'
import { bloquear as bloquearEspacio } from './espacios.service.js'
import * as pagos from './pagos.service.js'
import { vigentesPorTipo } from './tarifas.service.js'
import { exigirTurnoActivo } from './turnos.service.js'
import { obtenerORegistrar } from './vehiculos.service.js'

const SELECT_MOVIMIENTO = `
  SELECT m.id_movimiento, m.id_vehiculo, v.placa, v.id_tipo_vehiculo, tv.nombre AS tipo, m.id_espacio, e.codigo AS espacio,
         m.id_turno_entrada, m.id_turno_salida, m.fecha_hora_entrada, m.fecha_hora_salida, m.minutos, m.valor_total, m.estado
    FROM movimientos m
    JOIN vehiculos v       ON v.id_vehiculo = m.id_vehiculo
    JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
    JOIN espacios e        ON e.id_espacio = m.id_espacio`

async function porId(idMovimiento, conn) {
  const [m] = await query(`${SELECT_MOVIMIENTO} WHERE m.id_movimiento = ?`, [idMovimiento], conn)
  return m ?? null
}

/** RF-008: registra la entrada de un vehículo en un espacio disponible del mismo tipo. */
export async function registrarEntrada(actor, body = {}) {
  return transaction(async (conn) => {
    const turno = await exigirTurnoActivo(actor.id_usuario, conn)
    const vehiculo = await obtenerORegistrar(conn, body)

    const [abierto] = await query(
      `SELECT m.id_movimiento, e.codigo FROM movimientos m JOIN espacios e ON e.id_espacio = m.id_espacio
        WHERE m.id_vehiculo = ? AND m.estado = 'EN_PARQUEADERO' FOR UPDATE`,
      [vehiculo.id_vehiculo],
      conn,
    )
    if (abierto) throw conflict(`El vehículo ${vehiculo.placa} ya tiene una entrada abierta en el espacio ${abierto.codigo}.`)

    const espacio = await bloquearEspacio(conn, { id_espacio: body.id_espacio, codigo: body.codigo_espacio })
    if (espacio.id_tipo_vehiculo !== vehiculo.id_tipo_vehiculo) {
      throw conflict(`El espacio ${espacio.codigo} no corresponde al tipo de vehículo ${vehiculo.tipo}.`)
    }
    const entrada = ahora()
    if (espacio.estado === 'RESERVADO') {
      const [reserva] = await query(
        `SELECT 1 FROM reservas WHERE id_espacio = ? AND id_vehiculo = ? AND estado = 'CONFIRMADA' AND fecha = ?`,
        [espacio.id_espacio, vehiculo.id_vehiculo, fechaLocal(entrada)],
        conn,
      )
      if (!reserva) throw conflict(`El espacio ${espacio.codigo} está reservado para otro vehículo.`)
    } else if (espacio.estado !== 'DISPONIBLE') {
      throw conflict(`El espacio ${espacio.codigo} no está disponible.`)
    }

    const r = await query(
      `INSERT INTO movimientos (id_vehiculo, id_espacio, id_turno_entrada, fecha_hora_entrada) VALUES (?, ?, ?, ?)`,
      [vehiculo.id_vehiculo, espacio.id_espacio, turno.id_turno, entrada],
      conn,
    )
    await query(`UPDATE espacios SET estado = 'OCUPADO' WHERE id_espacio = ?`, [espacio.id_espacio], conn)
    return porId(r.insertId, conn)
  })
}

/** RC-05: mensualidad vigente para el vehículo en la fecha indicada. */
async function mensualidadVigente(idVehiculo, dia, conn) {
  const [m] = await query(
    `SELECT id_mensualidad, fecha_inicio, fecha_fin FROM mensualidades
      WHERE id_vehiculo = ? AND ? BETWEEN fecha_inicio AND fecha_fin ORDER BY fecha_fin DESC LIMIT 1`,
    [idVehiculo, dia],
    conn,
  )
  return m ?? null
}

/** RF-010: cobro de una estadía con RC-01 a RC-05 y la tarifa vigente del día de salida (RC-09). */
export async function calcularValor(movimiento, salida, conn) {
  const dia = fechaLocal(salida)
  const mensualidad = await mensualidadVigente(movimiento.id_vehiculo, dia, conn)
  const tarifas = await vigentesPorTipo(movimiento.id_tipo_vehiculo, dia, conn)
  const cobro = calcularCobro({ entrada: new Date(movimiento.fecha_hora_entrada), salida, tarifas })
  if (mensualidad) {
    return { ...cobro, regla: 'MENSUALIDAD', total: 0, mensualidad, tarifas }
  }
  return { ...cobro, mensualidad: null, tarifas }
}

/** RF-009 y RF-010: vehículo dentro del parqueadero con el cobro calculado a la hora actual. */
export async function activoPorPlaca(placa) {
  const p = placaValida(placa)
  const [m] = await query(`${SELECT_MOVIMIENTO} WHERE v.placa = ? AND m.estado = 'EN_PARQUEADERO'`, [p])
  if (!m) throw notFound(`El vehículo ${p} no está dentro del parqueadero.`)
  const salida = ahora()
  return { movimiento: m, salida_calculada: salida, cobro: await calcularValor(m, salida) }
}

export async function cobroActual(idMovimiento) {
  const m = await porId(id(idMovimiento, 'id_movimiento'))
  if (!m) throw notFound('El movimiento no existe.')
  if (m.estado !== 'EN_PARQUEADERO') throw conflict('El vehículo ya registró su salida.')
  const salida = ahora()
  return { movimiento: m, salida_calculada: salida, cobro: await calcularValor(m, salida) }
}

/** RF-019: vehículos dentro del parqueadero. */
export function enOperacion(q = {}) {
  const { limit, offset } = paginacion(q)
  return query(
    `SELECT m.id_movimiento, v.placa, tv.nombre AS tipo, c.nombre AS cliente, e.codigo AS espacio, m.fecha_hora_entrada,
            TIMESTAMPDIFF(MINUTE, m.fecha_hora_entrada, ?) AS permanencia_min
       FROM movimientos m
       JOIN vehiculos v       ON v.id_vehiculo = m.id_vehiculo
       JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
       JOIN espacios e        ON e.id_espacio = m.id_espacio
       LEFT JOIN clientes c   ON c.id_cliente = v.id_cliente
      WHERE m.estado = 'EN_PARQUEADERO'
      ORDER BY m.fecha_hora_entrada LIMIT ? OFFSET ?`,
    [ahora(), limit, offset],
  )
}

/**
 * RF-011 y RF-012: calcula el cobro, registra el pago (si hay valor), finaliza el
 * movimiento y libera el espacio, todo en una transacción.
 */
export async function registrarSalida(actor, idMovimiento, body = {}) {
  const movId = id(idMovimiento, 'id_movimiento')
  return transaction(async (conn) => {
    const turno = await exigirTurnoActivo(actor.id_usuario, conn)
    const [bloqueado] = await query(`SELECT estado FROM movimientos WHERE id_movimiento = ? FOR UPDATE`, [movId], conn)
    if (!bloqueado) throw notFound('El movimiento no existe.')
    if (bloqueado.estado !== 'EN_PARQUEADERO') throw conflict('El vehículo no está dentro del parqueadero.')

    const movimiento = await porId(movId, conn)
    const salida = ahora()
    const cobro = await calcularValor(movimiento, salida, conn)
    const pago = cobro.total > 0
      ? await pagos.registrar(conn, { origen: { id_movimiento: movId }, idTurno: turno.id_turno, valor: cobro.total, efectivoRecibido: body.efectivo_recibido })
      : null

    await query(
      `UPDATE movimientos SET fecha_hora_salida = ?, id_turno_salida = ?, minutos = ?, valor_total = ?, estado = 'FINALIZADO'
        WHERE id_movimiento = ?`,
      [salida, turno.id_turno, cobro.minutos, cobro.total, movId],
      conn,
    )
    await query(`UPDATE espacios SET estado = 'DISPONIBLE' WHERE id_espacio = ?`, [movimiento.id_espacio], conn)
    return { movimiento: await porId(movId, conn), cobro, pago, espacio: { codigo: movimiento.espacio, estado: 'DISPONIBLE' } }
  })
}

/** RF-015: historial. El Trabajador solo ve los movimientos de sus turnos. */
export function historial(actor, q = {}) {
  const { limit, offset } = paginacion(q)
  const filtros = []
  const params = []
  if (q.placa) {
    filtros.push('v.placa = ?')
    params.push(placaValida(q.placa))
  }
  const dia = fecha(q.fecha, 'fecha', { requerido: false })
  if (dia) {
    filtros.push('DATE(m.fecha_hora_entrada) = ?')
    params.push(dia)
  }
  if (actor.rol !== 'ADMINISTRADOR') {
    filtros.push('(te.id_usuario = ? OR ts.id_usuario = ?)')
    params.push(actor.id_usuario, actor.id_usuario)
  }
  return query(
    `SELECT m.id_movimiento, v.placa, tv.nombre AS tipo, DATE_FORMAT(m.fecha_hora_entrada, '%Y-%m-%d') AS fecha,
            m.fecha_hora_entrada, m.fecha_hora_salida, m.minutos, m.valor_total, p.valor AS valor_pagado, m.estado,
            ue.nombre_completo AS trabajador_entrada, us.nombre_completo AS trabajador_salida
       FROM movimientos m
       JOIN vehiculos v       ON v.id_vehiculo = m.id_vehiculo
       JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
       JOIN turnos te         ON te.id_turno = m.id_turno_entrada
       JOIN usuarios ue       ON ue.id_usuario = te.id_usuario
       LEFT JOIN turnos ts    ON ts.id_turno = m.id_turno_salida
       LEFT JOIN usuarios us  ON us.id_usuario = ts.id_usuario
       LEFT JOIN pagos p      ON p.id_movimiento = m.id_movimiento
      ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
      ORDER BY m.fecha_hora_entrada DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )
}
