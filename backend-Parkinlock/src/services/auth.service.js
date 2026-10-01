import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../config/db.js'
import { forbidden, unauthorized } from '../utils/errors.js'
import { opcion, texto } from '../utils/validar.js'

export const ROLES = ['ADMINISTRADOR', 'TRABAJADOR']
export const BCRYPT_ROUNDS = 10
const HASH_FICTICIO = bcrypt.hashSync('parkinlock-usuario-inexistente', BCRYPT_ROUNDS)

export const hashContrasena = (contrasena) => bcrypt.hash(contrasena, BCRYPT_ROUNDS)

async function compararContrasena(contrasena, hash) {
  try {
    return await bcrypt.compare(contrasena, hash)
  } catch {
    return false
  }
}

export function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id_usuario, rol: usuario.rol }, env.jwtSecret, { expiresIn: env.jwtExpiresIn })
}

export function verificarToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret)
  } catch {
    throw unauthorized('La sesión no es válida o expiró.')
  }
}

/** RF-001: inicio de sesión con usuario o correo, contraseña y rol seleccionado. */
export async function login(body = {}) {
  const usuario = texto(body.usuario, 'usuario', { max: 120 })
  const contrasena = texto(body.contrasena, 'contrasena', { max: 200 })
  const rolSeleccionado = opcion(body.rol, 'rol', ROLES, { requerido: false })

  const [u] = await query(
    `SELECT u.id_usuario, u.nombre_completo, u.usuario, u.correo, u.contrasena_hash, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.usuario = ? OR u.correo = ?
      LIMIT 1`,
    [usuario, usuario],
  )
  const valida = await compararContrasena(contrasena, u?.contrasena_hash ?? HASH_FICTICIO)
  if (!u || !valida || u.estado !== 'ACTIVO') throw unauthorized('Usuario o contraseña incorrectos.')
  if (rolSeleccionado && rolSeleccionado !== u.rol) throw forbidden('El usuario no tiene el rol seleccionado.')

  const datos = { id_usuario: u.id_usuario, nombre_completo: u.nombre_completo, usuario: u.usuario, correo: u.correo, rol: u.rol }
  return { token: firmarToken(datos), usuario: datos }
}

/** Usuario vigente del token: se consulta en cada petición para reflejar cambios de rol o estado. */
export async function usuarioDesdeToken(token) {
  const payload = verificarToken(token)
  const [u] = await query(
    `SELECT u.id_usuario, u.nombre_completo, u.usuario, u.correo, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.id_usuario = ?`,
    [payload.sub],
  )
  if (!u || u.estado !== 'ACTIVO') throw unauthorized('El usuario no existe o está inactivo.')
  return { id_usuario: u.id_usuario, nombre_completo: u.nombre_completo, usuario: u.usuario, correo: u.correo, rol: u.rol }
}

export async function perfil(usuario) {
  const permisos = await query(
    `SELECT p.area, p.nivel_acceso FROM permisos p JOIN roles r ON r.id_rol = p.id_rol WHERE r.nombre = ? ORDER BY p.id_permiso`,
    [usuario.rol],
  )
  const [turno] = await query(
    `SELECT id_turno, caja, inicio_programado, fin_programado, caja_inicial, estado
       FROM turnos WHERE id_usuario = ? AND estado = 'ABIERTO' ORDER BY id_turno DESC LIMIT 1`,
    [usuario.id_usuario],
  )
  return { usuario, permisos, turno_activo: turno ?? null }
}
