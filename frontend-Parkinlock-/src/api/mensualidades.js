import { api } from './client.js'

export const listar = (params) => api.get('/mensualidades', params)
export const calcularFin = (fecha_inicio) => api.get('/mensualidades/calcular-fin', { fecha_inicio })
export const crear = (datos) => api.post('/mensualidades', datos)
