import { api } from './client.js'

export const vigentes = (fecha) => api.get('/tarifas/vigentes', { fecha })
export const historial = () => api.get('/tarifas/historial')
export const configurar = (datos) => api.put('/tarifas', datos)
