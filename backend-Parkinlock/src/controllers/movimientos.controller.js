import * as movimientos from '../services/movimientos.service.js'

export const registrarEntrada = async (req, res) => res.status(201).json(await movimientos.registrarEntrada(req.usuario, req.body))
export const activoPorPlaca = async (req, res) => res.json(await movimientos.activoPorPlaca(req.query.placa))
export const enOperacion = async (req, res) => res.json(await movimientos.enOperacion(req.query))
export const cobroActual = async (req, res) => res.json(await movimientos.cobroActual(req.params.id))
export const registrarSalida = async (req, res) => res.json(await movimientos.registrarSalida(req.usuario, req.params.id, req.body))
export const historial = async (req, res) => res.json(await movimientos.historial(req.usuario, req.query))
