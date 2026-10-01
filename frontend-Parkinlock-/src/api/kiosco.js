import { request } from './client.js'

const k = (method, path, body) => request(method, path, { body, kiosco: true })

export const perfil = () => k('GET', '/auth/me')
export const tipos = () => k('GET', '/vehiculos/tipos')
export const buscarPorPlaca = (placa) => k('GET', `/vehiculos/placa/${encodeURIComponent(placa)}`)
export const mapa = () => k('GET', '/espacios')
export const registrarEntrada = (datos) => k('POST', '/movimientos/entrada', datos)
