import { Router } from 'express'
import * as c from '../controllers/usuarios.controller.js'
import { soloAdministrador } from '../middleware/auth.js'

// RF-018: gestión de usuarios, exclusiva del Administrador ("Tarifas y usuarios: Configurar").
const router = Router()
router.use(soloAdministrador)
router.get('/', c.listar)
router.post('/', c.crear)
router.get('/:id', c.obtener)
router.put('/:id', c.actualizar)
router.patch('/:id/estado', c.cambiarEstado)
export default router
