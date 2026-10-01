import * as usuarios from '../services/usuarios.service.js'

export const listar = async (_req, res) => res.json(await usuarios.listar())
export const obtener = async (req, res) => res.json(await usuarios.obtener(req.params.id))
export const crear = async (req, res) => res.status(201).json(await usuarios.crear(req.body))
export const actualizar = async (req, res) => res.json(await usuarios.actualizar(req.usuario, req.params.id, req.body))
export const cambiarEstado = async (req, res) => res.json(await usuarios.cambiarEstado(req.usuario, req.params.id, req.body))
