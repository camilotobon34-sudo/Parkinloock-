import { api } from './client.js'

export const login = (usuario, contrasena, rol) => api.post('/auth/login', { usuario, contrasena, rol })
export const loginCliente = (usuario, nombre_completo, correo) => api.post('/auth/cliente', { usuario, nombre_completo, correo })
export const registrarCliente = (usuario, nombre_completo, correo, contrasena) =>
  api.post('/auth/registro-cliente', { usuario, nombre_completo, correo, contrasena })
export const me = () => api.get('/auth/me')
