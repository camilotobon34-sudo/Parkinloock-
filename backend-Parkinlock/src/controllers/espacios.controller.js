import * as espacios from '../services/espacios.service.js'
import * as movimientos from '../services/movimientos.service.js'

export const mapa = async (_req, res) => res.json(await espacios.mapa())
export const ocupar = async (req, res) =>
  res.status(201).json(await movimientos.registrarEntrada(req.usuario, { ...req.body, id_espacio: req.params.id }))
export const liberar = async (req, res) => res.json(await espacios.liberar(req.params.id))
