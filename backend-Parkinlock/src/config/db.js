import mysql from 'mysql2/promise'
import { env } from './env.js'

let pool

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      ...env.db,
      waitForConnections: true,
      connectionLimit: 10,
      timezone: 'local',
      dateStrings: ['DATE'],
      decimalNumbers: true,
    })
  }
  return pool
}

/** Ejecuta una consulta con el pool o con la conexión de una transacción. */
export async function query(sql, params = [], conn = getPool()) {
  const [rows] = await conn.query(sql, params)
  return rows
}

export async function transaction(fn) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

export async function closePool() {
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
