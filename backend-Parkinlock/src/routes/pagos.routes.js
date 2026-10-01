import { Router } from 'express'
import * as c from '../controllers/pagos.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

// Los pagos se registran dentro de la salida, la confirmación de reserva y la creación de mensualidad.
const router = Router()
router.post('/calcular-cambio', c.calcularCambio)
router.get('/', soloAdministrador, c.listar)
router.get('/:id', c.obtener)
export default router
