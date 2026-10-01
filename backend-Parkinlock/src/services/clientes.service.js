import { query } from '../config/db.js'
import { notFound } from '../utils/errors.js'
import { id, paginacion, texto } from '../utils/validar.js'

export async function obtener(idCliente, conn) {
  const [c] = await query(`SELECT id_cliente, nombre, telefono FROM clientes WHERE id_cliente = ?`, [id(idCliente, 'id_cliente')], conn)
  if (!c) throw notFound('El cliente no existe.')
  return c
}

export async function crear(body = {}) {
  const nombre = texto(body.nombre, 'nombre', { max: 120 })
  const telefono = texto(body.telefono, 'telefono', { requerido: false, max: 20 })
  const r = await query(`INSERT INTO clientes (nombre, telefono) VALUES (?, ?)`, [nombre, telefono])
  return obtener(r.insertId)
}

export function listar(q = {}) {
  const { limit, offset } = paginacion(q)
  const buscar = texto(q.buscar, 'buscar', { requerido: false, max: 120 })
  return query(
    `SELECT id_cliente, nombre, telefono FROM clientes ${buscar ? 'WHERE nombre LIKE ? OR telefono LIKE ?' : ''}
      ORDER BY nombre LIMIT ? OFFSET ?`,
    buscar ? [`%${buscar}%`, `%${buscar}%`, limit, offset] : [limit, offset],
  )
}

export async function actualizar(idCliente, body = {}) {
  const actual = await obtener(idCliente)
  const nombre = body.nombre !== undefined ? texto(body.nombre, 'nombre', { max: 120 }) : actual.nombre
  const telefono = body.telefono !== undefined ? texto(body.telefono, 'telefono', { requerido: false, max: 20 }) : actual.telefono
  await query(`UPDATE clientes SET nombre = ?, telefono = ? WHERE id_cliente = ?`, [nombre, telefono, actual.id_cliente])
  return obtener(actual.id_cliente)
}
