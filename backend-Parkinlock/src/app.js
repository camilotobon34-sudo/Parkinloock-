import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { manejarErrores, rutaNoEncontrada } from './middleware/errores.js'
import routes from './routes/index.js'

export function crearApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: env.corsOrigin.split(',').map((o) => o.trim()) }))
  app.use(express.json({ limit: '100kb' }))
  app.use('/api', routes)
  app.use(rutaNoEncontrada)
  app.use(manejarErrores)
  return app
}

export default crearApp
