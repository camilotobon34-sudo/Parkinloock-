import { api } from './client.js'

export const tipos = () => api.get('/vehiculos/tipos')
export const listar = (params) => api.get('/vehiculos', params)
export const buscarPorPlaca = (placa) => api.get(`/vehiculos/placa/${encodeURIComponent(placa)}`)
export const registrar = (datos) => api.post('/vehiculos', datos)
export const actualizar = (id, datos) => api.put(`/vehiculos/${id}`, datos)
