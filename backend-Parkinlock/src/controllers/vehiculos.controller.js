import * as vehiculos from '../services/vehiculos.service.js'

export const tipos = async (_req, res) => res.json(await vehiculos.tipos())
export const listar = async (req, res) => res.json(await vehiculos.listar(req.query))
export const buscarPorPlaca = async (req, res) => res.json(await vehiculos.buscarPorPlaca(req.params.placa))
export const registrar = async (req, res) => res.status(201).json(await vehiculos.registrar(req.body))
export const actualizar = async (req, res) => res.json(await vehiculos.actualizar(req.params.id, req.body))
