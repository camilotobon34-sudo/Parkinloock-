import * as tarifas from '../services/tarifas.service.js'
import { fecha } from '../utils/validar.js'

export const vigentes = async (req, res) => res.json(await tarifas.vigentes(fecha(req.query.fecha, 'fecha', { requerido: false }) ?? undefined))
export const historial = async (_req, res) => res.json(await tarifas.historial())
export const configurar = async (req, res) => res.json(await tarifas.configurar(req.body))
