import { api } from './client.js'

export const login = (usuario, contrasena, rol) => api.post('/auth/login', { usuario, contrasena, rol })
export const me = () => api.get('/auth/me')
