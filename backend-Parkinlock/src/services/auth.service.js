import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { query } from '../config/db.js'
import { badRequest, conflict, forbidden, unauthorized } from '../utils/errors.js'
import { opcion, texto } from '../utils/validar.js'

export const ROLES = ['ADMINISTRADOR', 'TRABAJADOR', 'CLIENTE']
export const ROLES_PERSONAL = ['ADMINISTRADOR', 'TRABAJADOR']
export const BCRYPT_ROUNDS = 10
const HASH_FICTICIO = bcrypt.hashSync('parkinlock-usuario-inexistente', BCRYPT_ROUNDS)

export const hashContrasena = (contrasena) => bcrypt.hash(contrasena, BCRYPT_ROUNDS)

async function asegurarRolCliente() {
  await query(
    `INSERT INTO roles (nombre, descripcion) VALUES ('CLIENTE', 'Se registra con usuario, nombre, correo y contraseña')
     ON DUPLICATE KEY UPDATE nombre = nombre`,
  )
}

function validarContrasenaCliente(valor) {
  const c = texto(valor, 'contrasena', { max: 72 })
  if (c.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres.')
  return c
}

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

/** Registro de cliente: crea la cuenta con contraseña e inicia sesión. */
export async function registrarCliente(body = {}) {
  const usuario = texto(body.usuario, 'usuario', { max: 50 })
  if (!/^[A-Za-z0-9._@-]+$/.test(usuario)) throw badRequest('El usuario solo puede tener letras, números, punto, @, guion y guion bajo.')
  const nombre = texto(body.nombre_completo, 'nombre_completo', { max: 120 })
  const correo = texto(body.correo, 'correo', { max: 120 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw badRequest('El correo no es válido.')
  const contrasena = validarContrasenaCliente(body.contrasena)

  await asegurarRolCliente()

  const [porUsuario] = await query(`SELECT id_usuario FROM usuarios WHERE usuario = ?`, [usuario])
  if (porUsuario) throw conflict('Ese usuario ya está registrado. Inicia sesión.')
  const [porCorreo] = await query(`SELECT id_usuario FROM usuarios WHERE correo = ?`, [correo])
  if (porCorreo) throw conflict('Ese correo ya está registrado. Inicia sesión.')

  const [rol] = await query(`SELECT id_rol FROM roles WHERE nombre = 'CLIENTE'`)
  const creado = await query(
    `INSERT INTO usuarios (id_rol, nombre_completo, usuario, correo, contrasena_hash) VALUES (?, ?, ?, ?, ?)`,
    [rol.id_rol, nombre, usuario, correo, await hashContrasena(contrasena)],
  )
  const datos = { id_usuario: creado.insertId, nombre_completo: nombre, usuario, correo, rol: 'CLIENTE' }
  return { token: firmarToken(datos), usuario: datos }
}

/** Compatibilidad: ingreso rápido de cliente sin contraseña (crea o reconoce la cuenta). */
export async function ingresarCliente(body = {}) {
  const usuario = texto(body.usuario, 'usuario', { max: 50 })
  if (!/^[A-Za-z0-9._@-]+$/.test(usuario)) throw badRequest('El usuario solo puede tener letras, números, punto, @, guion y guion bajo.')
  const nombre = texto(body.nombre_completo, 'nombre_completo', { max: 120 })
  const correo = texto(body.correo, 'correo', { max: 120 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw badRequest('El correo no es válido.')

  await asegurarRolCliente()

  const [porUsuario] = await query(
    `SELECT u.id_usuario, u.nombre_completo, u.usuario, u.correo, u.estado, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.usuario = ?`,
    [usuario],
  )
  const [porCorreo] = await query(
    `SELECT u.id_usuario, u.usuario, r.nombre AS rol
       FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.correo = ?`,
    [correo],
  )

  if (porUsuario && porUsuario.rol !== 'CLIENTE') throw forbidden('Este usuario no es un cliente.')
  if (porCorreo && porCorreo.rol !== 'CLIENTE') throw forbidden('Este correo no pertenece a un cliente.')
  if (porUsuario && porCorreo && porUsuario.id_usuario !== porCorreo.id_usuario) throw conflict('El usuario y el correo no coinciden.')
  if (porUsuario?.estado === 'INACTIVO') throw unauthorized('El usuario no existe o está inactivo.')

  const actual = porUsuario ?? (porCorreo
    ? (await query(
        `SELECT u.id_usuario, u.nombre_completo, u.usuario, u.correo, u.estado, r.nombre AS rol
           FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
          WHERE u.id_usuario = ?`,
        [porCorreo.id_usuario],
      ))[0]
    : null)

  if (actual?.estado === 'INACTIVO') throw unauthorized('El usuario no existe o está inactivo.')

  let datos
  if (actual) {
    if (actual.usuario !== usuario) throw conflict('El usuario y el correo no coinciden.')
    await query(`UPDATE usuarios SET nombre_completo = ?, correo = ? WHERE id_usuario = ?`, [nombre, correo, actual.id_usuario])
    datos = { id_usuario: actual.id_usuario, nombre_completo: nombre, usuario, correo, rol: 'CLIENTE' }
  } else {
    const [rol] = await query(`SELECT id_rol FROM roles WHERE nombre = 'CLIENTE'`)
    const creado = await query(
      `INSERT INTO usuarios (id_rol, nombre_completo, usuario, correo, contrasena_hash) VALUES (?, ?, ?, ?, ?)`,
      [rol.id_rol, nombre, usuario, correo, await hashContrasena(randomBytes(24).toString('hex'))],
    )
    datos = { id_usuario: creado.insertId, nombre_completo: nombre, usuario, correo, rol: 'CLIENTE' }
  }

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
