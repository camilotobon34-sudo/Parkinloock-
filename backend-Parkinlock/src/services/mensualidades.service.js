import { query, transaction } from '../config/db.js'
import { badRequest, conflict } from '../utils/errors.js'
import { fechaLocal } from '../utils/fechas.js'
import { calcularFechaFin, estadoMensualidad } from '../utils/mensualidad.js'
import { placaValida } from '../utils/placa.js'
import { fecha } from '../utils/validar.js'
import { obtener as obtenerCliente } from './clientes.service.js'
import * as pagos from './pagos.service.js'
import { vigentesPorTipo } from './tarifas.service.js'
import { exigirTurnoActivo } from './turnos.service.js'
import { asegurarCliente, obtenerORegistrar } from './vehiculos.service.js'

const ESTADOS = ['ACTIVA', 'POR VENCER', 'VENCIDA']

export function calcularFin(q = {}) {
  const inicio = fecha(q.fecha_inicio ?? fechaLocal(), 'fecha_inicio')
  return { fecha_inicio: inicio, fecha_fin: calcularFechaFin(inicio) }
}

/** RF-014 y RC-07: crea la mensualidad de un mes y cobra la tarifa Mensualidad vigente. */
export async function crear(actor, body = {}) {
  const hoy = fechaLocal()
  const inicio = fecha(body.fecha_inicio ?? hoy, 'fecha_inicio')
  if (inicio < hoy) throw badRequest('La fecha de inicio no puede ser pasada.')
  const fin = calcularFechaFin(inicio)

  return transaction(async (conn) => {
    const turno = await exigirTurnoActivo(actor.id_usuario, conn)
    const cliente = await obtenerCliente(body.id_cliente, conn)
    const vehiculo = await obtenerORegistrar(conn, { ...body, id_cliente: cliente.id_cliente })
    await asegurarCliente(conn, vehiculo, cliente.id_cliente)

    const [cruce] = await query(
      `SELECT fecha_inicio, fecha_fin FROM mensualidades
        WHERE id_vehiculo = ? AND fecha_inicio <= ? AND fecha_fin >= ? FOR UPDATE`,
      [vehiculo.id_vehiculo, fin, inicio],
      conn,
    )
    if (cruce) throw conflict(`El vehículo ${vehiculo.placa} ya tiene una mensualidad del ${cruce.fecha_inicio} al ${cruce.fecha_fin}.`)

    const tarifas = await vigentesPorTipo(vehiculo.id_tipo_vehiculo, hoy, conn)
    const r = await query(
      `INSERT INTO mensualidades (id_vehiculo, id_cliente, fecha_inicio, fecha_fin, valor) VALUES (?, ?, ?, ?, ?)`,
      [vehiculo.id_vehiculo, cliente.id_cliente, inicio, fin, tarifas.MENSUALIDAD],
      conn,
    )
    const pago = await pagos.registrar(conn, {
      origen: { id_mensualidad: r.insertId },
      idTurno: turno.id_turno,
      valor: tarifas.MENSUALIDAD,
      efectivoRecibido: body.efectivo_recibido,
    })
    return {
      mensualidad: {
        id_mensualidad: r.insertId,
        placa: vehiculo.placa,
        tipo: vehiculo.tipo,
        cliente: cliente.nombre,
        fecha_inicio: inicio,
        fecha_fin: fin,
        valor: tarifas.MENSUALIDAD,
        estado: estadoMensualidad(fin, hoy),
      },
      pago,
    }
  })
}

/** RF-014 y RC-10: listado con estado calculado por fecha y resumen. */
export async function listar(q = {}) {
  const hoy = fechaLocal()
  await query(`UPDATE mensualidades SET estado = 'VENCIDA' WHERE estado = 'ACTIVA' AND fecha_fin < ?`, [hoy])
  const placa = q.placa ? placaValida(q.placa) : null
  const filas = await query(
    `SELECT m.id_mensualidad, v.placa, tv.nombre AS tipo, CONCAT(UPPER(LEFT(tv.nombre, 1)), LOWER(SUBSTRING(tv.nombre, 2)), ' mensual') AS plan,
            c.nombre AS titular, m.fecha_inicio, m.fecha_fin, m.valor
       FROM mensualidades m
       JOIN vehiculos v       ON v.id_vehiculo = m.id_vehiculo
       JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = v.id_tipo_vehiculo
       JOIN clientes c        ON c.id_cliente = m.id_cliente
      ${placa ? 'WHERE v.placa = ?' : ''}
      ORDER BY m.fecha_fin DESC`,
    placa ? [placa] : [],
  )
  const estadoFiltro = q.estado ? String(q.estado).toUpperCase().replace('_', ' ') : null
  if (estadoFiltro && !ESTADOS.includes(estadoFiltro)) throw badRequest(`estado debe ser uno de: ${ESTADOS.join(', ')}.`)

  const mensualidades = filas
    .map((m) => ({ ...m, estado: estadoMensualidad(m.fecha_fin, hoy) }))
    .filter((m) => !estadoFiltro || m.estado === estadoFiltro)
  const resumen = { total: filas.length, activas: 0, por_vencer: 0, vencidas: 0 }
  const contador = { ACTIVA: 'activas', 'POR VENCER': 'por_vencer', VENCIDA: 'vencidas' }
  for (const m of filas) resumen[contador[estadoMensualidad(m.fecha_fin, hoy)]]++
  return { fecha: hoy, resumen, mensualidades }
}
