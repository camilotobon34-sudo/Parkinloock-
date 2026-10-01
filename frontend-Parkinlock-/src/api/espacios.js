import { api } from './client.js'

export const mapa = () => api.get('/espacios')
export const ocupar = (id, datos) => api.post(`/espacios/${id}/ocupar`, datos)
export const liberar = (id) => api.post(`/espacios/${id}/liberar`)
