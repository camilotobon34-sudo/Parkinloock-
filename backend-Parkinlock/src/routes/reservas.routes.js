import { Router } from 'express'
import * as c from '../controllers/reservas.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

// Matriz de permisos: Administrador "Gestionar", Trabajador "Crear y ver".
const router = Router()
router.get('/', c.listar)
router.post('/', c.crear)
router.post('/:id/confirmar', soloAdministrador, c.confirmar)
router.post('/:id/cancelar', soloAdministrador, c.cancelar)
export default router
