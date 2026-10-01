import { crearApp } from './app.js'
import { closePool } from './config/db.js'
import { env, validarEntorno } from './config/env.js'

validarEntorno()
const server = crearApp().listen(env.port, () => {
  console.log(`PARKINLOCK API escuchando en http://localhost:${env.port}/api`)
})

const apagar = () => server.close(() => closePool().finally(() => process.exit(0)))
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)
