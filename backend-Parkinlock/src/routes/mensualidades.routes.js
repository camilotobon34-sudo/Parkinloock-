import { Router } from 'express'
import * as c from '../controllers/mensualidades.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

// Matriz de permisos: Administrador "Gestionar", Trabajador "Solo ver".
const router = Router()
router.get('/', c.listar)
router.get('/calcular-fin', c.calcularFin)
router.post('/', soloAdministrador, c.crear)
export default router
