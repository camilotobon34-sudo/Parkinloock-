import { api } from './client.js'

export const resumen = () => api.get('/panel')
