import { Router } from 'express'
import * as c from '../controllers/clientes.controller.js'

const router = Router()
router.get('/', c.listar)
router.post('/', c.crear)
router.get('/:id', c.obtener)
router.put('/:id', c.actualizar)
export default router
