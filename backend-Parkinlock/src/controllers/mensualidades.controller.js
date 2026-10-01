import * as mensualidades from '../services/mensualidades.service.js'

export const listar = async (req, res) => res.json(await mensualidades.listar(req.query))
export const calcularFin = async (req, res) => res.json(mensualidades.calcularFin(req.query))
export const crear = async (req, res) => res.status(201).json(await mensualidades.crear(req.usuario, req.body))
