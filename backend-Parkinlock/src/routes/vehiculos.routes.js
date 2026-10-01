import { Router } from 'express'
import * as c from '../controllers/vehiculos.controller.js'

const router = Router()
router.get('/tipos', c.tipos)
router.get('/', c.listar)
router.post('/', c.registrar)
router.get('/placa/:placa', c.buscarPorPlaca)
router.put('/:id', c.actualizar)
export default router
