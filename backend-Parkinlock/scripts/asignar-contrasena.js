// Uso: npm run usuarios:contrasena -- <usuario> <contraseña>
// Asigna una contraseña (guardada con bcrypt) a un usuario existente, por ejemplo
// a los usuarios de prueba "admin" y "trabajador" creados por parkinlock_db.sql.
import { closePool, query } from '../src/config/db.js'
import { hashContrasena } from '../src/services/auth.service.js'

const [usuario, contrasena] = process.argv.slice(2)
if (!usuario || !contrasena || contrasena.length < 8) {
  console.error('Uso: npm run usuarios:contrasena -- <usuario> <contraseña de al menos 8 caracteres>')
  process.exit(1)
}

try {
  const r = await query(`UPDATE usuarios SET contrasena_hash = ? WHERE usuario = ?`, [await hashContrasena(contrasena), usuario])
  if (r.affectedRows === 0) {
    console.error(`No existe el usuario "${usuario}".`)
    process.exitCode = 1
  } else {
    console.log(`Contraseña actualizada para "${usuario}".`)
  }
} finally {
  await closePool()
}
