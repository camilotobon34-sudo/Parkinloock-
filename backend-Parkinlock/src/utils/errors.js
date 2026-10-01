export class AppError extends Error {
  constructor(status, message, detalles) {
    super(message)
    this.status = status
    this.detalles = detalles
  }
}

export const badRequest = (msg, detalles) => new AppError(400, msg, detalles)
export const unauthorized = (msg = 'No autenticado.') => new AppError(401, msg)
export const forbidden = (msg = 'No tiene permiso para realizar esta acción.') => new AppError(403, msg)
export const notFound = (msg = 'Recurso no encontrado.') => new AppError(404, msg)
export const conflict = (msg, detalles) => new AppError(409, msg, detalles)
