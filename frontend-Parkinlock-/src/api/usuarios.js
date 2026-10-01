import { api } from './client.js'

export const listar = () => api.get('/usuarios')
export const obtener = (id) => api.get(`/usuarios/${id}`)
export const crear = (datos) => api.post('/usuarios', datos)
export const actualizar = (id, datos) => api.put(`/usuarios/${id}`, datos)
export const cambiarEstado = (id, estado) => api.patch(`/usuarios/${id}/estado`, { estado })
