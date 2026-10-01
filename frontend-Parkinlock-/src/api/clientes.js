import { api } from './client.js'

export const listar = (params) => api.get('/clientes', params)
export const obtener = (id) => api.get(`/clientes/${id}`)
export const crear = (datos) => api.post('/clientes', datos)
export const actualizar = (id, datos) => api.put(`/clientes/${id}`, datos)
