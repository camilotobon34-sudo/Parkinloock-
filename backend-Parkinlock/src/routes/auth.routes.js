import { Router } from 'express'
import * as c from '../controllers/auth.controller.js'
import { autenticar } from '../middleware/auth.js'

const router = Router()
router.post('/login', c.login)
router.post('/cliente', c.cliente)
router.post('/registro-cliente', c.registrarCliente)
router.get('/me', autenticar, c.me)
export default router
