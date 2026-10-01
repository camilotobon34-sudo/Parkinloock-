import * as reservas from '../services/reservas.service.js'

export const listar = async (req, res) => res.json(await reservas.listar(req.query))
export const crear = async (req, res) => res.status(201).json(await reservas.crear(req.usuario, req.body))
export const confirmar = async (req, res) => res.json(await reservas.confirmar(req.usuario, req.params.id, req.body))
export const cancelar = async (req, res) => res.json(await reservas.cancelar(req.params.id))
