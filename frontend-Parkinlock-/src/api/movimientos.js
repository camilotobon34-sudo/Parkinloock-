import { api } from './client.js'

export const registrarEntrada = (datos) => api.post('/movimientos/entrada', datos)
export const activoPorPlaca = (placa) => api.get('/movimientos/activo', { placa })
export const enOperacion = (params) => api.get('/movimientos/en-operacion', params)
export const historial = (params) => api.get('/movimientos/historial', params)
export const cobro = (id) => api.get(`/movimientos/${id}/cobro`)
export const registrarSalida = (id, efectivo_recibido) => api.post(`/movimientos/${id}/salida`, { efectivo_recibido })
