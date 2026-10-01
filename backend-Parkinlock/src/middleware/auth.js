import { usuarioDesdeToken } from '../services/auth.service.js'
import { forbidden, unauthorized } from '../utils/errors.js'

export async function autenticar(req, _res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ')
  if (tipo !== 'Bearer' || !token) throw unauthorized('Debe iniciar sesión.')
  req.usuario = await usuarioDesdeToken(token)
  next()
}

/** Permite el acceso solo a los roles indicados (ADMINISTRADOR, TRABAJADOR). */
export const permitir = (...roles) => (req, _res, next) => {
  if (!req.usuario || !roles.includes(req.usuario.rol)) throw forbidden()
  next()
}

export const soloAdministrador = permitir('ADMINISTRADOR')
