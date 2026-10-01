import { Router } from 'express'
import * as c from '../controllers/espacios.controller.js'

const router = Router()
router.get('/', c.mapa)
router.post('/:id/ocupar', c.ocupar)
router.post('/:id/liberar', c.liberar)
export default router
