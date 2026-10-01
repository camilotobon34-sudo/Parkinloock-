import { api } from './client.js'

export const listar = (fecha) => api.get('/reservas', { fecha })
export const crear = (datos) => api.post('/reservas', datos)
export const confirmar = (id, efectivo_recibido) => api.post(`/reservas/${id}/confirmar`, { efectivo_recibido })
export const cancelar = (id) => api.post(`/reservas/${id}/cancelar`)
