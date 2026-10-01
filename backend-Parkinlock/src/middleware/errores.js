import { AppError } from '../utils/errors.js'

const ERRORES_MYSQL = {
  ER_DUP_ENTRY: [409, 'Ya existe un registro con esos datos.'],
  ER_NO_REFERENCED_ROW_2: [400, 'Uno de los registros relacionados no existe.'],
  ER_ROW_IS_REFERENCED_2: [409, 'El registro está en uso y no se puede eliminar.'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Los datos no cumplen las reglas de la base de datos.'],
}

export function rutaNoEncontrada(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` })
}

export function manejarErrores(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.detalles ? { detalles: err.detalles } : {}) })
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' })
  }
  const mysql = ERRORES_MYSQL[err.code]
  if (mysql) return res.status(mysql[0]).json({ error: mysql[1] })

  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor.' })
}
