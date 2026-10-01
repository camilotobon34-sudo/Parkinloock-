import { api } from './client.js'

export const calcularCambio = (valor, efectivo_recibido) => api.post('/pagos/calcular-cambio', { valor, efectivo_recibido })
export const listar = (params) => api.get('/pagos', params)
export const obtener = (id) => api.get(`/pagos/${id}`)
