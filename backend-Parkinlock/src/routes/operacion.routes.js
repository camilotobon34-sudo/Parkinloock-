import { Router } from 'express'
import * as c from '../controllers/operacion.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

export const alertas = Router()
alertas.get('/', c.alertasActivas)
alertas.patch('/:id/atender', c.atenderAlerta)

export const turnos = Router()
turnos.get('/activo', c.turnoActivo)
turnos.get('/', soloAdministrador, c.listarTurnos)
turnos.post('/', c.abrirTurno)
turnos.post('/:id/cerrar', c.cerrarTurno)

export const panel = Router()
panel.get('/', c.resumenPanel)
