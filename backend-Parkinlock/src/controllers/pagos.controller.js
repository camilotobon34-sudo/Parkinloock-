import * as pagos from '../services/pagos.service.js'

export const calcularCambio = async (req, res) => res.json(pagos.calcularCambioVista(req.body))
export const listar = async (req, res) => res.json(await pagos.listar(req.query))
export const obtener = async (req, res) => res.json(await pagos.obtener(req.usuario, req.params.id))
