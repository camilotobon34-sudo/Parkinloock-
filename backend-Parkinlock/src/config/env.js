import 'dotenv/config'

// Las fechas se guardan en DATETIME (sin zona horaria) y RC-04 depende de la
// hora local, por eso todo el proceso trabaja en la zona horaria del parqueadero.
process.env.TZ = process.env.APP_TZ || 'America/Bogota'

export const env = {
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'parkinlock_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
  },
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}

export function validarEntorno() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET es obligatorio y debe tener al menos 32 caracteres.')
  }
}
