import { Router } from 'express'
import * as c from '../controllers/tarifas.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

// RF-017: Tarifas y usuarios — Administrador "Configurar", Trabajador "Sin acceso".
// El Trabajador obtiene el valor a cobrar desde /movimientos/:id/cobro.
const router = Router()
router.use(soloAdministrador)
router.get('/vigentes', c.vigentes)
router.get('/historial', c.historial)
router.put('/', c.configurar)
export default router
