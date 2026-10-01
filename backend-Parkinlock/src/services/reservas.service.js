import { query, transaction } from '../config/db.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import { ahora, fechaLocal, horaLocal } from '../utils/fechas.js'
import { fecha, hora, id } from '../utils/validar.js'
import { obtener as obtenerCliente } from './clientes.service.js'
import { bloquear as bloquearEspacio } from './espacios.service.js'
import * as pagos from './pagos.service.js'
import { vigentesPorTipo } from './tarifas.service.js'
import { exigirTurnoActivo } from './turnos.service.js'
import { asegurarCliente, obtenerORegistrar } from './vehiculos.service.js'

const SELECT_RESERVA = `
  SELECT r.id_reserva, r.fecha, r.hora_inicio, r.hora_fin, r.estado, r.id_vehiculo, v.placa, tv.nombre AS tipo,
         r.id_cliente, c.nombre AS cliente, r.id_espacio, e.codigo AS espacio, r.id_usuario, u.nombre_completo AS registrada_por,
         p.id_pago, p.valor AS valor_pagado
    FROM reservas r
    JOIN vehiculos v       ON v.id_vehiculo = r.id_vehiculo
    JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
    JOIN clientes c        ON c.id_cliente = r.id_cliente
    JOIN usuarios u        ON u.id_usuario = r.id_usuario
    LEFT JOIN espacios e   ON e.id_espacio = r.id_espacio
    LEFT JOIN pagos p      ON p.id_reserva = r.id_reserva`

async function porId(idReserva, conn) {
  const [r] = await query(`${SELECT_RESERVA} WHERE r.id_reserva = ?`, [idReserva], conn)
  if (!r) throw notFound('La reserva no existe.')
  return r
}

/** RF-013: crea una reserva PENDIENTE validando fecha, horario, cliente, vehículo y cruces. */
export async function crear(actor, body = {}) {
  const dia = fecha(body.fecha, 'fecha')
  const inicio = hora(body.hora_inicio, 'hora_inicio')
  const fin = hora(body.hora_fin, 'hora_fin')
  if (fin <= inicio) throw badRequest('La hora de fin debe ser posterior a la hora de inicio.')
  const hoy = fechaLocal()
  if (dia < hoy || (dia === hoy && fin <= horaLocal())) throw badRequest('La reserva no puede quedar en el pasado.')

  return transaction(async (conn) => {
    const cliente = await obtenerCliente(body.id_cliente, conn)
    const vehiculo = await obtenerORegistrar(conn, { ...body, id_cliente: cliente.id_cliente })
    await asegurarCliente(conn, vehiculo, cliente.id_cliente)

    const [cruceVehiculo] = await query(
      `SELECT id_reserva FROM reservas WHERE id_vehiculo = ? AND fecha = ? AND hora_inicio < ? AND hora_fin > ? FOR UPDATE`,
      [vehiculo.id_vehiculo, dia, fin, inicio],
      conn,
    )
    if (cruceVehiculo) throw conflict(`El vehículo ${vehiculo.placa} ya tiene una reserva en ese horario.`)

    let idEspacio = null
    if (body.id_espacio || body.codigo_espacio) {
      const espacio = await bloquearEspacio(conn, { id_espacio: body.id_espacio, codigo: body.codigo_espacio })
      if (espacio.id_tipo_vehiculo !== vehiculo.id_tipo_vehiculo) {
        throw conflict(`El espacio ${espacio.codigo} no corresponde al tipo de vehículo ${vehiculo.tipo}.`)
      }
      const [cruceEspacio] = await query(
        `SELECT id_reserva FROM reservas WHERE id_espacio = ? AND fecha = ? AND hora_inicio < ? AND hora_fin > ?`,
        [espacio.id_espacio, dia, fin, inicio],
        conn,
      )
      if (cruceEspacio) throw conflict(`El espacio ${espacio.codigo} ya está reservado en ese horario.`)
      idEspacio = espacio.id_espacio
    }

    const r = await query(
      `INSERT INTO reservas (id_vehiculo, id_cliente, id_espacio, id_usuario, fecha, hora_inicio, hora_fin) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vehiculo.id_vehiculo, cliente.id_cliente, idEspacio, actor.id_usuario, dia, inicio, fin],
      conn,
    )
    return porId(r.insertId, conn)
  })
}

export async function listar(q = {}) {
  const dia = fecha(q.fecha ?? fechaLocal(), 'fecha')
  const reservas = await query(`${SELECT_RESERVA} WHERE r.fecha = ? ORDER BY r.hora_inicio`, [dia])
  return {
    fecha: dia,
    resumen: { programadas: reservas.length, sin_espacio: reservas.filter((r) => !r.id_espacio).length },
    reservas,
  }
}

/** RC-06: al confirmar se cobra la tarifa Reserva vigente del tipo de vehículo. */
export async function confirmar(actor, idReserva, body = {}) {
  const reservaId = id(idReserva, 'id_reserva')
  return transaction(async (conn) => {
    const turno = await exigirTurnoActivo(actor.id_usuario, conn)
    const [r] = await query(`SELECT * FROM reservas WHERE id_reserva = ? FOR UPDATE`, [reservaId], conn)
    if (!r) throw notFound('La reserva no existe.')
    if (r.estado !== 'PENDIENTE') throw conflict('La reserva ya está confirmada.')
    const hoy = fechaLocal()
    if (r.fecha < hoy || (r.fecha === hoy && r.hora_fin <= horaLocal())) throw conflict('La reserva ya venció.')

    const [v] = await query(`SELECT id_tipo_vehiculo FROM vehiculos WHERE id_vehiculo = ?`, [r.id_vehiculo], conn)
    const tarifas = await vigentesPorTipo(v.id_tipo_vehiculo, fechaLocal(ahora()), conn)
    const pago = await pagos.registrar(conn, {
      origen: { id_reserva: reservaId },
      idTurno: turno.id_turno,
      valor: tarifas.RESERVA,
      efectivoRecibido: body.efectivo_recibido,
    })
    await query(`UPDATE reservas SET estado = 'CONFIRMADA' WHERE id_reserva = ?`, [reservaId], conn)
    return { reserva: await porId(reservaId, conn), pago }
  })
}

/**
 * Cancelación: solo reservas PENDIENTES (sin pago). Una reserva CONFIRMADA ya tiene
 * su cargo cobrado y la documentación no define reembolsos, por eso no se cancela.
 */
export async function cancelar(idReserva) {
  const reservaId = id(idReserva, 'id_reserva')
  return transaction(async (conn) => {
    const [r] = await query(`SELECT estado FROM reservas WHERE id_reserva = ? FOR UPDATE`, [reservaId], conn)
    if (!r) throw notFound('La reserva no existe.')
    if (r.estado !== 'PENDIENTE') throw conflict('Una reserva confirmada ya tiene el cargo cobrado y no se puede cancelar.')
    await query(`DELETE FROM alertas WHERE id_reserva = ?`, [reservaId], conn)
    await query(`DELETE FROM reservas WHERE id_reserva = ?`, [reservaId], conn)
    return { id_reserva: reservaId, cancelada: true }
  })
}
