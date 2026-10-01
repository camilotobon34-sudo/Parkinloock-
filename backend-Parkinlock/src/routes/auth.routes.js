import { Router } from 'express'
import * as c from '../controllers/auth.controller.js'
import { autenticar } from '../middleware/auth.js'

const router = Router()
router.post('/login', c.login)
router.get('/me', autenticar, c.me)
export default router
