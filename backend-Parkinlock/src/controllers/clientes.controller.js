import * as clientes from '../services/clientes.service.js'

export const listar = async (req, res) => res.json(await clientes.listar(req.query))
export const obtener = async (req, res) => res.json(await clientes.obtener(req.params.id))
export const crear = async (req, res) => res.status(201).json(await clientes.crear(req.body))
export const actualizar = async (req, res) => res.json(await clientes.actualizar(req.params.id, req.body))
