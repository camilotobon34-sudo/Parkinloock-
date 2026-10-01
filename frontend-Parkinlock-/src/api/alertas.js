import { api } from './client.js'

export const activas = () => api.get('/alertas')
export const atender = (id) => api.patch(`/alertas/${id}/atender`, {})
