import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import mysql from 'mysql2/promise'
import { env } from './env.js'

// En Vercel usamos SQLite salvo que se pida MySQL explícitamente (DB_CLIENT=mysql).
const useSqlite =
  process.env.DB_CLIENT === 'sqlite' ||
  (Boolean(process.env.VERCEL) && process.env.DB_CLIENT !== 'mysql') ||
  (!process.env.VERCEL && process.env.DB_CLIENT === 'sqlite')

let pool
let sqlite
let sqliteReady

function toSqliteSql(sql) {
  let s = String(sql)
  s = s.replace(/\s+FOR UPDATE(?:\s+OF\s+\w+)?/gi, '')
  s = s.replace(
    /INSERT INTO tarifas \(id_tipo_vehiculo, concepto, valor, vigente_desde\) VALUES \(\?, \?, \?, \?\) AS nueva\s+ON DUPLICATE KEY UPDATE valor = nueva\.valor/gi,
    `INSERT INTO tarifas (id_tipo_vehiculo, concepto, valor, vigente_desde) VALUES (?, ?, ?, ?)
     ON CONFLICT(id_tipo_vehiculo, concepto, vigente_desde) DO UPDATE SET valor = excluded.valor`,
  )
  s = s.replace(/\s+ON DUPLICATE KEY UPDATE\s+nombre\s*=\s*nombre/gi, '')
  s = s.replace(/\s+ON DUPLICATE KEY UPDATE\s+usuario\s*=\s*usuarios\.usuario/gi, '')
  s = s.replace(/\s+ON DUPLICATE KEY UPDATE\s+area\s*=\s*permisos\.area/gi, '')
  s = s.replace(/\s+ON DUPLICATE KEY UPDATE\s+valor\s*=\s*tarifas\.valor/gi, '')
  s = s.replace(/\s+ON DUPLICATE KEY UPDATE\s+codigo\s*=\s*espacios\.codigo/gi, '')
  s = s.replace(/TIMESTAMPDIFF\(\s*MINUTE\s*,\s*([^,]+)\s*,\s*([^)]+)\)/gi, 'CAST((julianday($2) - julianday($1)) * 1440 AS INTEGER)')
  s = s.replace(/\bGREATEST\s*\(/gi, 'max(')
  s = s.replace(/\bLEAST\s*\(/gi, 'min(')
  s = s.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m-%d'\s*\)/gi, 'strftime(\'%Y-%m-%d\', $1)')
  s = s.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m-%d %H:%i:%s'\s*\)/gi, 'strftime(\'%Y-%m-%d %H:%M:%S\', $1)')
  s = s.replace(/\bDATE\s*\(/gi, 'date(')
  s = s.replace(/FIELD\(([^,]+),\s*([\s\S]*?)\)/gi, (_, col, list) => {
    const parts = list.split(',').map((p) => p.trim()).filter(Boolean)
    return `CASE ${col.trim()} ${parts.map((p, i) => `WHEN ${p} THEN ${i}`).join(' ')} ELSE 999 END`
  })
  return s
}

function initSqlite() {
  if (sqlite) return sqlite
  const dir = process.env.VERCEL ? join(tmpdir(), 'parkinlock') : join(process.cwd(), '.data')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, 'parkinlock.sqlite')
  sqlite = new DatabaseSync(file)
  sqlite.exec('PRAGMA foreign_keys = ON;')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id_rol INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT
    );
    CREATE TABLE IF NOT EXISTS permisos (
      id_permiso INTEGER PRIMARY KEY AUTOINCREMENT,
      id_rol INTEGER NOT NULL,
      area TEXT NOT NULL,
      nivel_acceso TEXT NOT NULL,
      UNIQUE (id_rol, area),
      FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      id_rol INTEGER NOT NULL,
      nombre_completo TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE,
      correo TEXT UNIQUE,
      contrasena_hash TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'ACTIVO',
      fecha_creacion TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
    );
    CREATE TABLE IF NOT EXISTS turnos (
      id_turno INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      caja TEXT NOT NULL,
      inicio_programado TEXT NOT NULL,
      fin_programado TEXT NOT NULL,
      caja_inicial REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'ABIERTO',
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    );
    CREATE TABLE IF NOT EXISTS tipos_vehiculo (
      id_tipo_vehiculo INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS espacios (
      id_espacio INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      id_tipo_vehiculo INTEGER NOT NULL,
      nivel TEXT,
      estado TEXT NOT NULL DEFAULT 'DISPONIBLE',
      FOREIGN KEY (id_tipo_vehiculo) REFERENCES tipos_vehiculo(id_tipo_vehiculo)
    );
    CREATE TABLE IF NOT EXISTS clientes (
      id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT
    );
    CREATE TABLE IF NOT EXISTS vehiculos (
      id_vehiculo INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT NOT NULL UNIQUE,
      id_tipo_vehiculo INTEGER NOT NULL,
      id_cliente INTEGER,
      FOREIGN KEY (id_tipo_vehiculo) REFERENCES tipos_vehiculo(id_tipo_vehiculo),
      FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tarifas (
      id_tarifa INTEGER PRIMARY KEY AUTOINCREMENT,
      id_tipo_vehiculo INTEGER NOT NULL,
      concepto TEXT NOT NULL,
      valor REAL NOT NULL,
      vigente_desde TEXT NOT NULL,
      UNIQUE (id_tipo_vehiculo, concepto, vigente_desde),
      FOREIGN KEY (id_tipo_vehiculo) REFERENCES tipos_vehiculo(id_tipo_vehiculo)
    );
    CREATE TABLE IF NOT EXISTS movimientos (
      id_movimiento INTEGER PRIMARY KEY AUTOINCREMENT,
      id_vehiculo INTEGER NOT NULL,
      id_espacio INTEGER NOT NULL,
      id_turno_entrada INTEGER NOT NULL,
      id_turno_salida INTEGER,
      fecha_hora_entrada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_hora_salida TEXT,
      minutos INTEGER,
      valor_total REAL,
      estado TEXT NOT NULL DEFAULT 'EN_PARQUEADERO',
      FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
      FOREIGN KEY (id_espacio) REFERENCES espacios(id_espacio),
      FOREIGN KEY (id_turno_entrada) REFERENCES turnos(id_turno),
      FOREIGN KEY (id_turno_salida) REFERENCES turnos(id_turno)
    );
    CREATE TABLE IF NOT EXISTS reservas (
      id_reserva INTEGER PRIMARY KEY AUTOINCREMENT,
      id_vehiculo INTEGER NOT NULL,
      id_cliente INTEGER NOT NULL,
      id_espacio INTEGER,
      id_usuario INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      hora_inicio TEXT NOT NULL,
      hora_fin TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'PENDIENTE',
      FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
      FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
      FOREIGN KEY (id_espacio) REFERENCES espacios(id_espacio),
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    );
    CREATE TABLE IF NOT EXISTS mensualidades (
      id_mensualidad INTEGER PRIMARY KEY AUTOINCREMENT,
      id_vehiculo INTEGER NOT NULL,
      id_cliente INTEGER NOT NULL,
      fecha_inicio TEXT NOT NULL,
      fecha_fin TEXT NOT NULL,
      valor REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'ACTIVA',
      FOREIGN KEY (id_vehiculo) REFERENCES vehiculos(id_vehiculo),
      FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
    );
    CREATE TABLE IF NOT EXISTS pagos (
      id_pago INTEGER PRIMARY KEY AUTOINCREMENT,
      id_movimiento INTEGER UNIQUE,
      id_reserva INTEGER UNIQUE,
      id_mensualidad INTEGER,
      id_turno INTEGER NOT NULL,
      metodo TEXT NOT NULL DEFAULT 'EFECTIVO',
      valor REAL NOT NULL,
      efectivo_recibido REAL NOT NULL,
      cambio REAL NOT NULL,
      fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_movimiento) REFERENCES movimientos(id_movimiento),
      FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva),
      FOREIGN KEY (id_mensualidad) REFERENCES mensualidades(id_mensualidad),
      FOREIGN KEY (id_turno) REFERENCES turnos(id_turno)
    );
    CREATE TABLE IF NOT EXISTS alertas (
      id_alerta INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      id_reserva INTEGER,
      fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      estado TEXT NOT NULL DEFAULT 'ACTIVA',
      FOREIGN KEY (id_reserva) REFERENCES reservas(id_reserva)
    );
    CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );
  `)

  const seed = () => {
    sqlite.exec(`
      INSERT OR IGNORE INTO roles (nombre, descripcion) VALUES
        ('ADMINISTRADOR', 'Configura tarifas, usuarios y permisos'),
        ('TRABAJADOR', 'Opera entradas, salidas y cobros'),
        ('CLIENTE', 'Ingresa con su usuario, nombre y correo');
      INSERT OR IGNORE INTO tipos_vehiculo (nombre) VALUES ('CARRO'), ('MOTO');
    `)

    const roles = sqlite.prepare('SELECT id_rol, nombre FROM roles').all()
    const idRol = Object.fromEntries(roles.map((r) => [r.nombre, r.id_rol]))
    const permisos = [
      ['ADMINISTRADOR', 'PANEL', 'Ver y editar'],
      ['TRABAJADOR', 'PANEL', 'Ver'],
      ['ADMINISTRADOR', 'ENTRADAS_SALIDAS', 'Gestionar'],
      ['TRABAJADOR', 'ENTRADAS_SALIDAS', 'Gestionar'],
      ['ADMINISTRADOR', 'RESERVAS', 'Gestionar'],
      ['TRABAJADOR', 'RESERVAS', 'Crear y ver'],
      ['ADMINISTRADOR', 'MENSUALIDADES', 'Gestionar'],
      ['TRABAJADOR', 'MENSUALIDADES', 'Solo ver'],
      ['ADMINISTRADOR', 'HISTORIAL', 'Ver y exportar'],
      ['TRABAJADOR', 'HISTORIAL', 'Ver turno propio'],
      ['ADMINISTRADOR', 'TARIFAS_USUARIOS', 'Configurar'],
      ['TRABAJADOR', 'TARIFAS_USUARIOS', 'Sin acceso'],
    ]
    const insPerm = sqlite.prepare('INSERT OR IGNORE INTO permisos (id_rol, area, nivel_acceso) VALUES (?, ?, ?)')
    for (const [rol, area, nivel] of permisos) insPerm.run(idRol[rol], area, nivel)

    const tipos = sqlite.prepare('SELECT id_tipo_vehiculo, nombre FROM tipos_vehiculo').all()
    const idTipo = Object.fromEntries(tipos.map((t) => [t.nombre, t.id_tipo_vehiculo]))
    const tarifas = [
      ['CARRO', 'HORA', 5000], ['MOTO', 'HORA', 3000],
      ['CARRO', 'FRACCION', 5000], ['MOTO', 'FRACCION', 3000],
      ['CARRO', 'NOCHE', 25000], ['MOTO', 'NOCHE', 15000],
      ['CARRO', 'DIA', 35000], ['MOTO', 'DIA', 22000],
      ['CARRO', 'RESERVA', 8000], ['MOTO', 'RESERVA', 5000],
      ['CARRO', 'MENSUALIDAD', 180000], ['MOTO', 'MENSUALIDAD', 95000],
    ]
    const insTar = sqlite.prepare(
      'INSERT OR IGNORE INTO tarifas (id_tipo_vehiculo, concepto, valor, vigente_desde) VALUES (?, ?, ?, ?)',
    )
    for (const [tipo, concepto, valor] of tarifas) insTar.run(idTipo[tipo], concepto, valor, '2026-10-01')

    const espacios = [
      ['C-01', 'CARRO'], ['C-02', 'CARRO'], ['C-12', 'CARRO'],
      ['M-01', 'MOTO'], ['M-02', 'MOTO'],
    ]
    const insEsp = sqlite.prepare('INSERT OR IGNORE INTO espacios (codigo, id_tipo_vehiculo) VALUES (?, ?)')
    for (const [codigo, tipo] of espacios) insEsp.run(codigo, idTipo[tipo])

    const adminHash = '$2b$10$wJ2jfAiSs9otaRGPmwkiE.x06/oxKmgZ5oyCS052MS1QFjwydWbUy'
    const trabHash = '$2b$10$OfLiddI46Lg01jOvL5N7Wu5IGafZpe//uOY8XlKQMHbwifqruNA8e'
    const insUser = sqlite.prepare(
      'INSERT OR IGNORE INTO usuarios (id_rol, nombre_completo, usuario, correo, contrasena_hash) VALUES (?, ?, ?, ?, ?)',
    )
    insUser.run(idRol.ADMINISTRADOR, 'Loren Orozco Vargas', 'lorozcovargas210@gmail.com', 'lorozcovargas210@gmail.com', adminHash)
    insUser.run(idRol.TRABAJADOR, 'Trabajador de prueba', 'trabajador', null, trabHash)

    const yaDemo = sqlite.prepare(`SELECT valor FROM meta WHERE clave = 'demo_operacion_v1'`).get()
    if (!yaDemo) {
      const pad = (n) => String(n).padStart(2, '0')
      const fechaDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      const base = new Date()
      base.setHours(12, 0, 0, 0)
      const dia = (offset) => {
        const d = new Date(base)
        d.setDate(d.getDate() + offset)
        return fechaDe(d)
      }

      sqlite.exec('BEGIN')
      try {
        const admin = sqlite.prepare(`SELECT id_usuario FROM usuarios WHERE usuario = ?`).get('lorozcovargas210@gmail.com')
        const trab = sqlite.prepare(`SELECT id_usuario FROM usuarios WHERE usuario = ?`).get('trabajador')
        const idAdmin = admin?.id_usuario
        const idTrab = trab?.id_usuario

        sqlite.prepare(`INSERT OR IGNORE INTO clientes (id_cliente, nombre, telefono) VALUES (1, ?, ?)`).run('Ana Pérez', '3001112233')
        sqlite.prepare(`INSERT OR IGNORE INTO clientes (id_cliente, nombre, telefono) VALUES (2, ?, ?)`).run('Carlos Ruiz', '3014445566')
        sqlite.prepare(`INSERT OR IGNORE INTO clientes (id_cliente, nombre, telefono) VALUES (3, ?, ?)`).run('María López', '3027778899')

        sqlite
          .prepare(`INSERT OR IGNORE INTO vehiculos (id_vehiculo, placa, id_tipo_vehiculo, id_cliente) VALUES (1, ?, ?, 1)`)
          .run('ABC123', idTipo.CARRO)
        sqlite
          .prepare(`INSERT OR IGNORE INTO vehiculos (id_vehiculo, placa, id_tipo_vehiculo, id_cliente) VALUES (2, ?, ?, 2)`)
          .run('XYZ987', idTipo.CARRO)
        sqlite
          .prepare(`INSERT OR IGNORE INTO vehiculos (id_vehiculo, placa, id_tipo_vehiculo, id_cliente) VALUES (3, ?, ?, 3)`)
          .run('MOTO45', idTipo.MOTO)

        const esp = Object.fromEntries(
          sqlite.prepare(`SELECT codigo, id_espacio FROM espacios`).all().map((e) => [e.codigo, e.id_espacio]),
        )

        if (idAdmin && idTrab && esp['C-01'] && esp['C-02'] && esp['M-01']) {
          const insTurno = sqlite.prepare(
            `INSERT INTO turnos (id_usuario, caja, inicio_programado, fin_programado, caja_inicial, estado)
             VALUES (?, ?, ?, ?, ?, 'CERRADO')`,
          )
          const insMov = sqlite.prepare(
            `INSERT INTO movimientos
              (id_vehiculo, id_espacio, id_turno_entrada, id_turno_salida, fecha_hora_entrada, fecha_hora_salida, minutos, valor_total, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'FINALIZADO')`,
          )
          const insPago = sqlite.prepare(
            `INSERT INTO pagos (id_movimiento, id_reserva, id_mensualidad, id_turno, metodo, valor, efectivo_recibido, cambio, fecha_hora)
             VALUES (?, NULL, NULL, ?, 'EFECTIVO', ?, ?, ?, ?)`,
          )
          const insReserva = sqlite.prepare(
            `INSERT INTO reservas (id_vehiculo, id_cliente, id_espacio, id_usuario, fecha, hora_inicio, hora_fin, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )

          const turnosDemo = [
            { user: idTrab, caja: 'Caja 1', d: -3 },
            { user: idTrab, caja: 'Caja 1', d: -2 },
            { user: idAdmin, caja: 'Caja 1', d: -1 },
          ]
          const idsTurno = turnosDemo.map((t) => {
            const f = dia(t.d)
            const info = insTurno.run(t.user, t.caja, `${f} 07:00:00`, `${f} 15:00:00`, 50000)
            return Number(info.lastInsertRowid)
          })

          const hist = [
            { turno: idsTurno[0], veh: 1, esp: esp['C-01'], d: -3, ent: '08:10:00', sal: '10:25:00', min: 135, valor: 15000, ef: 20000 },
            { turno: idsTurno[0], veh: 3, esp: esp['M-01'], d: -3, ent: '09:00:00', sal: '11:00:00', min: 120, valor: 6000, ef: 10000 },
            { turno: idsTurno[1], veh: 2, esp: esp['C-02'], d: -2, ent: '08:40:00', sal: '12:10:00', min: 210, valor: 20000, ef: 20000 },
            { turno: idsTurno[1], veh: 1, esp: esp['C-01'], d: -2, ent: '13:00:00', sal: '14:30:00', min: 90, valor: 10000, ef: 10000 },
            { turno: idsTurno[2], veh: 3, esp: esp['M-01'], d: -1, ent: '07:30:00', sal: '09:15:00', min: 105, valor: 6000, ef: 10000 },
            { turno: idsTurno[2], veh: 2, esp: esp['C-02'], d: -1, ent: '10:00:00', sal: '13:45:00', min: 225, valor: 20000, ef: 50000 },
          ]
          for (const h of hist) {
            const f = dia(h.d)
            const mov = insMov.run(h.veh, h.esp, h.turno, h.turno, `${f} ${h.ent}`, `${f} ${h.sal}`, h.min, h.valor)
            const idMov = Number(mov.lastInsertRowid)
            insPago.run(idMov, h.turno, h.valor, h.ef, h.ef - h.valor, `${f} ${h.sal}`)
          }

          // Reservas futuras para poder crear/confirmar en cualquier hora del día.
          insReserva.run(1, 1, esp['C-01'], idAdmin, dia(1), '09:00:00', '11:00:00', 'PENDIENTE')
          insReserva.run(3, 3, esp['M-01'], idAdmin, dia(1), '14:00:00', '16:00:00', 'PENDIENTE')
          insReserva.run(2, 2, esp['C-02'], idAdmin, dia(2), '10:00:00', '12:00:00', 'PENDIENTE')
        }

        sqlite.prepare(`INSERT INTO meta (clave, valor) VALUES ('demo_operacion_v1', '1')`).run()
        sqlite.exec('COMMIT')
      } catch (err) {
        sqlite.exec('ROLLBACK')
        throw err
      }
    }
  }

  seed()
  return sqlite
}

function ensureSqlite() {
  if (!sqliteReady) {
    initSqlite()
    sqliteReady = true
  }
  return sqlite
}

export function getPool() {
  if (useSqlite) return ensureSqlite()
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

function bindSqliteParam(value) {
  if (value === undefined || value === null) return null
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
  }
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'bigint') return Number(value)
  return value
}

function runSqlite(db, sql, params = []) {
  const prepared = db.prepare(toSqliteSql(sql))
  const bound = params.map(bindSqliteParam)
  const trimmed = sql.trim().toLowerCase()
  if (trimmed.startsWith('select') || trimmed.startsWith('with')) {
    return prepared.all(...bound)
  }
  const info = prepared.run(...bound)
  return {
    insertId: Number(info.lastInsertRowid || 0),
    affectedRows: info.changes || 0,
    changedRows: info.changes || 0,
  }
}

/** Ejecuta una consulta con el pool o con la conexión de una transacción. */
export async function query(sql, params = [], conn = getPool()) {
  if (useSqlite) return runSqlite(conn || ensureSqlite(), sql, params)
  const [rows] = await conn.query(sql, params)
  return rows
}

export async function transaction(fn) {
  if (useSqlite) {
    const db = ensureSqlite()
    db.exec('BEGIN')
    try {
      const result = await fn(db)
      db.exec('COMMIT')
      return result
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

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
  if (useSqlite) {
    sqlite?.close?.()
    sqlite = undefined
    sqliteReady = false
    return
  }
  if (pool) {
    await pool.end()
    pool = undefined
  }
}
