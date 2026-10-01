import * as alertas from '../services/alertas.service.js'
import * as panel from '../services/panel.service.js'
import * as turnos from '../services/turnos.service.js'

export const alertasActivas = async (_req, res) => res.json(await alertas.activas())
export const atenderAlerta = async (req, res) => res.json(await alertas.atender(req.params.id))

export const turnoActivo = async (req, res) => res.json(await turnos.turnoActivo(req.usuario.id_usuario))
export const abrirTurno = async (req, res) => res.status(201).json(await turnos.abrir(req.usuario, req.body))
export const cerrarTurno = async (req, res) => res.json(await turnos.cerrar(req.usuario, req.params.id))
export const listarTurnos = async (req, res) => res.json(await turnos.listar(req.query))

export const resumenPanel = async (req, res) => res.json(await panel.resumen(req.usuario))
