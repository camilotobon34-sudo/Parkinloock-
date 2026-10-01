import { query, transaction } from '../config/db.js'
import { badRequest, conflict, notFound } from '../utils/errors.js'
import { id, opcion, texto } from '../utils/validar.js'
import { hashContrasena, ROLES } from './auth.service.js'

const SELECT_USUARIO = `
  SELECT u.id_usuario, u.nombre_completo, u.usuario, u.correo, u.estado, u.fecha_creacion, r.nombre AS rol
    FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol`

function validarContrasena(valor) {
  const c = texto(valor, 'contrasena', { max: 72 })
  if (c.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres.')
  return c
}

function validarCorreo(valor) {
  const c = texto(valor, 'correo', { requerido: false, max: 120 })
  if (c && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) throw badRequest('El correo no es válido.')
  return c
}

async function idRol(nombre, conn) {
  const [r] = await query(`SELECT id_rol FROM roles WHERE nombre = ?`, [nombre], conn)
  if (!r) throw badRequest('El rol no existe.')
  return r.id_rol
}

export async function obtener(idUsuario, conn) {
  const [u] = await query(`${SELECT_USUARIO} WHERE u.id_usuario = ?`, [id(idUsuario, 'id_usuario')], conn)
  if (!u) throw notFound('El usuario no existe.')
  return u
}

export const listar = () => query(`${SELECT_USUARIO} ORDER BY u.nombre_completo`)

export async function crear(body = {}) {
  const nombre = texto(body.nombre_completo, 'nombre_completo', { max: 120 })
  const usuario = texto(body.usuario, 'usuario', { max: 50 })
  if (!/^[A-Za-z0-9._-]+$/.test(usuario)) throw badRequest('El usuario solo puede tener letras, números, punto, guion y guion bajo.')
  const correo = validarCorreo(body.correo)
  const rol = opcion(body.rol, 'rol', ROLES)
  const hash = await hashContrasena(validarContrasena(body.contrasena))
  const r = await query(
    `INSERT INTO usuarios (id_rol, nombre_completo, usuario, correo, contrasena_hash) VALUES (?, ?, ?, ?, ?)`,
    [await idRol(rol), nombre, usuario, correo, hash],
  )
  return obtener(r.insertId)
}

/** Impide dejar el sistema sin ningún Administrador activo. */
async function protegerUltimoAdministrador(conn, actual, rolNuevo, estadoNuevo) {
  const dejaDeSerAdmin = actual.rol === 'ADMINISTRADOR' && actual.estado === 'ACTIVO' && (rolNuevo !== 'ADMINISTRADOR' || estadoNuevo !== 'ACTIVO')
  if (!dejaDeSerAdmin) return
  const [r] = await query(
    `SELECT COUNT(*) AS total FROM usuarios u JOIN roles ro ON ro.id_rol = u.id_rol
      WHERE ro.nombre = 'ADMINISTRADOR' AND u.estado = 'ACTIVO' AND u.id_usuario <> ? FOR UPDATE`,
    [actual.id_usuario],
    conn,
  )
  if (r.total === 0) throw conflict('Debe existir al menos un Administrador activo.')
}

export async function actualizar(actor, idUsuario, body = {}) {
  return transaction(async (conn) => {
    const actual = await obtener(idUsuario, conn)
    const nombre = body.nombre_completo !== undefined ? texto(body.nombre_completo, 'nombre_completo', { max: 120 }) : actual.nombre_completo
    const correo = body.correo !== undefined ? validarCorreo(body.correo) : actual.correo
    const rol = body.rol !== undefined ? opcion(body.rol, 'rol', ROLES) : actual.rol
    if (actor.id_usuario === actual.id_usuario && rol !== actual.rol) throw conflict('No puede cambiar su propio rol.')
    await protegerUltimoAdministrador(conn, actual, rol, actual.estado)

    await query(`UPDATE usuarios SET nombre_completo = ?, correo = ?, id_rol = ? WHERE id_usuario = ?`, [nombre, correo, await idRol(rol, conn), actual.id_usuario], conn)
    if (body.contrasena !== undefined) {
      const hash = await hashContrasena(validarContrasena(body.contrasena))
      await query(`UPDATE usuarios SET contrasena_hash = ? WHERE id_usuario = ?`, [hash, actual.id_usuario], conn)
    }
    return obtener(actual.id_usuario, conn)
  })
}

export async function cambiarEstado(actor, idUsuario, body = {}) {
  const estado = opcion(body.estado, 'estado', ['ACTIVO', 'INACTIVO'])
  return transaction(async (conn) => {
    const actual = await obtener(idUsuario, conn)
    if (actor.id_usuario === actual.id_usuario && estado === 'INACTIVO') throw conflict('No puede desactivar su propio usuario.')
    await protegerUltimoAdministrador(conn, actual, actual.rol, estado)
    if (estado === 'INACTIVO') {
      const [abierto] = await query(`SELECT 1 FROM turnos WHERE id_usuario = ? AND estado = 'ABIERTO'`, [actual.id_usuario], conn)
      if (abierto) throw conflict('El usuario tiene un turno abierto; ciérrelo antes de desactivarlo.')
    }
    await query(`UPDATE usuarios SET estado = ? WHERE id_usuario = ?`, [estado, actual.id_usuario], conn)
    return obtener(actual.id_usuario, conn)
  })
}
