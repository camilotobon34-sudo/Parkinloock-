import { api } from './client.js'

export const activo = () => api.get('/turnos/activo')
export const listar = (estado) => api.get('/turnos', { estado })
export const abrir = (datos) => api.post('/turnos', datos)
export const cerrar = (id) => api.post(`/turnos/${id}/cerrar`)
