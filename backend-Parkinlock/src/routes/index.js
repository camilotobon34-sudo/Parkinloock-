import { Router } from 'express'
import { getPool } from '../config/db.js'
import { autenticar } from '../middleware/auth.js'
import auth from './auth.routes.js'
import clientes from './clientes.routes.js'
import espacios from './espacios.routes.js'
import mensualidades from './mensualidades.routes.js'
import movimientos from './movimientos.routes.js'
import { alertas, panel, turnos } from './operacion.routes.js'
import pagos from './pagos.routes.js'
import reservas from './reservas.routes.js'
import tarifas from './tarifas.routes.js'
import usuarios from './usuarios.routes.js'
import vehiculos from './vehiculos.routes.js'

const router = Router()

router.get('/salud', async (_req, res) => {
  await getPool().query('SELECT 1')
  res.json({ estado: 'ok', base_de_datos: 'conectada' })
})
router.use('/auth', auth)

router.use(autenticar)
router.use('/usuarios', usuarios)
router.use('/clientes', clientes)
router.use('/vehiculos', vehiculos)
router.use('/espacios', espacios)
router.use('/movimientos', movimientos)
router.use('/tarifas', tarifas)
router.use('/pagos', pagos)
router.use('/reservas', reservas)
router.use('/mensualidades', mensualidades)
router.use('/alertas', alertas)
router.use('/turnos', turnos)
router.use('/panel', panel)

export default router
