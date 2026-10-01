import { Router } from 'express'
import * as c from '../controllers/movimientos.controller.js'

const router = Router()
router.post('/entrada', c.registrarEntrada)
router.get('/activo', c.activoPorPlaca)
router.get('/en-operacion', c.enOperacion)
router.get('/historial', c.historial)
router.get('/:id/cobro', c.cobroActual)
router.post('/:id/salida', c.registrarSalida)
export default router
