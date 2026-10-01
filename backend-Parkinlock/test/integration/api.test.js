// Pruebas de la API contra un MySQL 8 real y temporal (mysql-memory-server).
// La primera ejecución descarga MySQL; si no es posible iniciarlo, estas pruebas se omiten.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, describe, test } from 'node:test'
import mysql from 'mysql2/promise'
import { createDB } from 'mysql-memory-server'
import request from 'supertest'

const CLAVE_ADMIN = 'Admin-Prueba-2026'
const CLAVE_TRABAJADOR = 'Trabajador-Prueba-2026'

let servidor = null
let motivoOmision = false
try {
  servidor = await createDB({ version: '8.4.x', xEnabled: 'OFF', logLevel: 'ERROR' })
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: servidor.port,
    user: servidor.username,
    password: '',
    multipleStatements: true,
  })
  const sql = readFileSync(new URL('../../database/parkinlock_db.sql', import.meta.url), 'utf8')
  await conn.query(sql)
  await conn.query(sql) // el script debe poder ejecutarse más de una vez
  await conn.end()
} catch (e) {
  motivoOmision = `MySQL temporal no disponible: ${e.message}`
}

Object.assign(process.env, {
  DB_HOST: '127.0.0.1',
  DB_PORT: String(servidor?.port ?? 3306),
  DB_NAME: 'parkinlock_db',
  DB_USER: servidor?.username ?? 'root',
  DB_PASSWORD: '',
  JWT_SECRET: 'clave-solo-para-pruebas-automatizadas-0123456789',
})

const { crearApp } = await import('../../src/app.js')
const { closePool, query } = await import('../../src/config/db.js')
const { hashContrasena } = await import('../../src/services/auth.service.js')
const { ahora, fechaLocal } = await import('../../src/utils/fechas.js')
const { calcularFechaFin } = await import('../../src/utils/mensualidad.js')

const app = crearApp()
const diaRelativo = (dias) => fechaLocal(new Date(Date.now() + dias * 86_400_000))
const hoy = () => fechaLocal()

function api(metodo, url, token, body) {
  const r = request(app)[metodo](url)
  if (token) r.set('Authorization', `Bearer ${token}`)
  return body === undefined ? r : r.send(body)
}

async function login(usuario, contrasena, rol) {
  const r = await api('post', '/api/auth/login', null, { usuario, contrasena, rol })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body.token
}

after(async () => {
  await closePool()
  await servidor?.stop()
})

describe('API PARKINLOCK', { skip: motivoOmision }, () => {
  const ctx = {}

  test('preparación: contraseñas de los usuarios de prueba', async () => {
    await query(`UPDATE usuarios SET contrasena_hash = ? WHERE usuario = 'admin'`, [await hashContrasena(CLAVE_ADMIN)])
    await query(`UPDATE usuarios SET contrasena_hash = ? WHERE usuario = 'trabajador'`, [await hashContrasena(CLAVE_TRABAJADOR)])
    const salud = await api('get', '/api/salud')
    assert.equal(salud.status, 200)
  })

  test('1. login correcto', async () => {
    const r = await api('post', '/api/auth/login', null, { usuario: 'admin', contrasena: CLAVE_ADMIN, rol: 'ADMINISTRADOR' })
    assert.equal(r.status, 200)
    assert.ok(r.body.token)
    assert.equal(r.body.usuario.rol, 'ADMINISTRADOR')
    assert.equal(r.body.usuario.contrasena_hash, undefined)
    ctx.admin = r.body.token
    ctx.trabajador = await login('trabajador', CLAVE_TRABAJADOR, 'TRABAJADOR')

    const me = await api('get', '/api/auth/me', ctx.trabajador)
    assert.equal(me.status, 200)
    assert.equal(me.body.usuario.usuario, 'trabajador')
    assert.ok(me.body.permisos.length > 0)
  })

  test('2. login incorrecto', async () => {
    const mala = await api('post', '/api/auth/login', null, { usuario: 'admin', contrasena: 'incorrecta' })
    assert.equal(mala.status, 401)
    assert.equal(mala.body.error, 'Usuario o contraseña incorrectos.')
    const inexistente = await api('post', '/api/auth/login', null, { usuario: 'nadie', contrasena: 'x' })
    assert.equal(inexistente.status, 401)
    assert.equal(inexistente.body.error, mala.body.error)
    const rol = await api('post', '/api/auth/login', null, { usuario: 'trabajador', contrasena: CLAVE_TRABAJADOR, rol: 'ADMINISTRADOR' })
    assert.equal(rol.status, 403)
    const vacio = await api('post', '/api/auth/login', null, {})
    assert.equal(vacio.status, 400)
    assert.equal((await api('get', '/api/auth/me', 'token-falso')).status, 401)
  })

  test('3. contraseña guardada con hash bcrypt', async () => {
    const r = await api('post', '/api/usuarios', ctx.admin, {
      nombre_completo: 'Laura Gómez',
      usuario: 'laura',
      correo: 'laura@parkinlock.local',
      contrasena: 'Clave-Segura-1',
      rol: 'TRABAJADOR',
    })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.contrasena_hash, undefined)
    const [u] = await query(`SELECT contrasena_hash FROM usuarios WHERE usuario = 'laura'`)
    assert.notEqual(u.contrasena_hash, 'Clave-Segura-1')
    assert.match(u.contrasena_hash, /^\$2[aby]\$10\$.{53}$/)
    await login('laura@parkinlock.local', 'Clave-Segura-1')
  })

  test('4. control de acceso por rol (verificado en el backend)', async () => {
    assert.equal((await api('get', '/api/usuarios')).status, 401)
    assert.equal((await api('get', '/api/usuarios', ctx.trabajador)).status, 403)
    assert.equal((await api('put', '/api/tarifas', ctx.trabajador, { tarifas: [] })).status, 403)
    assert.equal((await api('get', '/api/tarifas/vigentes', ctx.trabajador)).status, 403)
    assert.equal((await api('post', '/api/mensualidades', ctx.trabajador, {})).status, 403)
    assert.equal((await api('post', '/api/reservas/1/confirmar', ctx.trabajador, {})).status, 403)
    assert.equal((await api('get', '/api/turnos', ctx.trabajador)).status, 403)
    assert.equal((await api('get', '/api/usuarios', ctx.admin)).status, 200)
    const tarifas = await api('get', '/api/tarifas/vigentes', ctx.admin)
    assert.equal(tarifas.status, 200)
    assert.equal(tarifas.body.tarifas.CARRO.HORA, 5000)
    assert.equal(tarifas.body.tarifas.MOTO.MENSUALIDAD, 95000)
  })

  test('las operaciones de caja exigen un turno abierto', async () => {
    const sinTurno = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'ABC123', tipo: 'CARRO', codigo_espacio: 'C-12' })
    assert.equal(sinTurno.status, 409)
    const turno = { caja: 'Caja 1', inicio_programado: `${hoy()} 00:00`, fin_programado: `${diaRelativo(1)} 00:00`, caja_inicial: 100000 }
    const t = await api('post', '/api/turnos', ctx.trabajador, turno)
    assert.equal(t.status, 201, JSON.stringify(t.body))
    ctx.turnoTrabajador = t.body.id_turno
    assert.equal((await api('post', '/api/turnos', ctx.trabajador, turno)).status, 409)
    assert.equal((await api('post', '/api/turnos', ctx.admin, { ...turno, caja: 'Caja 2' })).status, 201)
  })

  test('6. registrar entrada (placa normalizada)', async () => {
    const r = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'abc 123', tipo: 'carro', codigo_espacio: 'C-12' })
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.placa, 'ABC123')
    assert.equal(r.body.espacio, 'C-12')
    assert.equal(r.body.estado, 'EN_PARQUEADERO')
    ctx.movimiento = r.body.id_movimiento
    const mapa = await api('get', '/api/espacios', ctx.trabajador)
    assert.equal(mapa.body.espacios.find((e) => e.codigo === 'C-12').estado, 'OCUPADO')
  })

  test('5. buscar vehículo por placa', async () => {
    const r = await api('get', '/api/vehiculos/placa/abc123', ctx.trabajador)
    assert.equal(r.status, 200)
    assert.equal(r.body.placa, 'ABC123')
    assert.equal(r.body.en_parqueadero, true)
    assert.equal((await api('get', '/api/vehiculos/placa/ZZZ999', ctx.trabajador)).status, 404)
    assert.equal((await api('get', '/api/vehiculos/placa/%20', ctx.trabajador)).status, 400)
  })

  test('7. evitar doble entrada y validar espacios', async () => {
    const doble = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'ABC 123', codigo_espacio: 'C-01' })
    assert.equal(doble.status, 409)
    assert.match(doble.body.error, /ya tiene una entrada abierta/)
    const ocupado = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'XYZ789', tipo: 'CARRO', codigo_espacio: 'C-12' })
    assert.equal(ocupado.status, 409)
    const tipo = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'MTO12A', tipo: 'MOTO', codigo_espacio: 'C-01' })
    assert.equal(tipo.status, 409)
    const inexistente = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'XYZ789', tipo: 'CARRO', codigo_espacio: 'Z-99' })
    assert.equal(inexistente.status, 404)
    const vacia = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: '  ', tipo: 'CARRO', codigo_espacio: 'C-01' })
    assert.equal(vacia.status, 400)
    const sinTipo = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'NUE111', codigo_espacio: 'C-01' })
    assert.equal(sinTipo.status, 404)
  })

  test('8. calcular tarifa (2 h 28 min de carro = $15.000)', async () => {
    const entrada = new Date(ahora().getTime() - 148 * 60_000)
    await query(`UPDATE movimientos SET fecha_hora_entrada = ? WHERE id_movimiento = ?`, [entrada, ctx.movimiento])
    const r = await api('get', '/api/movimientos/activo?placa=abc123', ctx.trabajador)
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.cobro.minutos, 148)
    assert.equal(r.body.cobro.total, 15000)
    assert.deepEqual(r.body.cobro.desglose.map((d) => d.concepto), ['HORA', 'FRACCION'])
  })

  test('10. calcular cambio', async () => {
    const r = await api('post', '/api/pagos/calcular-cambio', ctx.trabajador, { valor: 15000, efectivo_recibido: 20000 })
    assert.equal(r.status, 200)
    assert.equal(r.body.cambio, 5000)
    const corto = await api('post', '/api/pagos/calcular-cambio', ctx.trabajador, { valor: 15000, efectivo_recibido: 12000 })
    assert.equal(corto.body.suficiente, false)
    assert.equal(corto.body.faltante, 3000)
    assert.equal((await api('post', '/api/pagos/calcular-cambio', ctx.trabajador, { valor: 15000, efectivo_recibido: -1 })).status, 400)
  })

  test('9 y 11. registrar pago y salida', async () => {
    const insuficiente = await api('post', `/api/movimientos/${ctx.movimiento}/salida`, ctx.trabajador, { efectivo_recibido: 12000 })
    assert.equal(insuficiente.status, 400)
    assert.match(insuficiente.body.error, /faltan \$3\.000/)
    const negativo = await api('post', `/api/movimientos/${ctx.movimiento}/salida`, ctx.trabajador, { efectivo_recibido: -20000 })
    assert.equal(negativo.status, 400)

    const r = await api('post', `/api/movimientos/${ctx.movimiento}/salida`, ctx.trabajador, { efectivo_recibido: 20000 })
    assert.equal(r.status, 200, JSON.stringify(r.body))
    assert.equal(r.body.movimiento.estado, 'FINALIZADO')
    assert.equal(r.body.movimiento.valor_total, 15000)
    assert.equal(r.body.pago.valor, 15000)
    assert.equal(r.body.pago.cambio, 5000)
    ctx.pago = r.body.pago.id_pago

    const pago = await api('get', `/api/pagos/${ctx.pago}`, ctx.trabajador)
    assert.equal(pago.status, 200)
    assert.equal(pago.body.concepto, 'SALIDA')
    assert.equal(pago.body.efectivo_recibido, 20000)

    const repetida = await api('post', `/api/movimientos/${ctx.movimiento}/salida`, ctx.trabajador, { efectivo_recibido: 20000 })
    assert.equal(repetida.status, 409)
    assert.equal((await api('get', '/api/movimientos/activo?placa=ABC123', ctx.trabajador)).status, 404)

    const historial = await api('get', '/api/movimientos/historial?placa=ABC123', ctx.trabajador)
    assert.equal(historial.body.length, 1)
    assert.equal(historial.body[0].valor_pagado, 15000)
  })

  test('12. liberar espacio', async () => {
    const mapa = await api('get', '/api/espacios', ctx.trabajador)
    const c12 = mapa.body.espacios.find((e) => e.codigo === 'C-12')
    assert.equal(c12.estado, 'DISPONIBLE')
    assert.equal(c12.placa, null)

    const otro = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'GQN54A', tipo: 'MOTO', codigo_espacio: 'M-01' })
    const m01 = otro.body.id_espacio
    const ocupado = await api('post', `/api/espacios/${m01}/liberar`, ctx.trabajador)
    assert.equal(ocupado.status, 409)
    assert.match(ocupado.body.error, /registre su salida/)

    await query(`UPDATE espacios SET estado = 'RESERVADO' WHERE codigo = 'M-02'`)
    const m02 = mapa.body.espacios.find((e) => e.codigo === 'M-02').id_espacio
    const libre = await api('post', `/api/espacios/${m02}/liberar`, ctx.trabajador)
    assert.equal(libre.status, 200)
    assert.equal(libre.body.estado, 'DISPONIBLE')
    assert.equal((await api('post', '/api/espacios/9999/liberar', ctx.trabajador)).status, 404)
  })

  test('13. crear reserva', async () => {
    const cliente = await api('post', '/api/clientes', ctx.trabajador, { nombre: 'Marta Ruiz', telefono: '3001234567' })
    assert.equal(cliente.status, 201)
    ctx.cliente = cliente.body.id_cliente

    const datos = { id_cliente: ctx.cliente, placa: 'def 456', tipo: 'CARRO', codigo_espacio: 'C-02', fecha: diaRelativo(1), hora_inicio: '10:00', hora_fin: '12:00' }
    const r = await api('post', '/api/reservas', ctx.trabajador, datos)
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.estado, 'PENDIENTE')
    assert.equal(r.body.placa, 'DEF456')
    ctx.reserva = r.body.id_reserva

    assert.equal((await api('post', '/api/reservas', ctx.trabajador, { ...datos, hora_inicio: '11:00', hora_fin: '13:00' })).status, 409)
    assert.equal((await api('post', '/api/reservas', ctx.trabajador, { ...datos, hora_inicio: '12:00', hora_fin: '10:00' })).status, 400)
    assert.equal((await api('post', '/api/reservas', ctx.trabajador, { ...datos, fecha: diaRelativo(-1) })).status, 400)
    assert.equal((await api('post', '/api/reservas', ctx.trabajador, { ...datos, id_cliente: 9999 })).status, 404)

    const confirmada = await api('post', `/api/reservas/${ctx.reserva}/confirmar`, ctx.admin, { efectivo_recibido: 10000 })
    assert.equal(confirmada.status, 200, JSON.stringify(confirmada.body))
    assert.equal(confirmada.body.reserva.estado, 'CONFIRMADA')
    assert.equal(confirmada.body.pago.valor, 8000)
    assert.equal(confirmada.body.pago.cambio, 2000)
    assert.equal((await api('post', `/api/reservas/${ctx.reserva}/cancelar`, ctx.admin)).status, 409)

    const otra = await api('post', '/api/reservas', ctx.trabajador, { ...datos, codigo_espacio: undefined, hora_inicio: '15:00', hora_fin: '16:00' })
    assert.equal(otra.status, 201)
    const cancelada = await api('post', `/api/reservas/${otra.body.id_reserva}/cancelar`, ctx.admin)
    assert.equal(cancelada.status, 200)
    const lista = await api('get', `/api/reservas?fecha=${diaRelativo(1)}`, ctx.trabajador)
    assert.equal(lista.body.resumen.programadas, 1)
  })

  test('14. crear mensualidad y RC-05 (sin cobro por horas)', async () => {
    const datos = { id_cliente: ctx.cliente, placa: 'lpk 211', tipo: 'CARRO', fecha_inicio: hoy(), efectivo_recibido: 200000 }
    const r = await api('post', '/api/mensualidades', ctx.admin, datos)
    assert.equal(r.status, 201, JSON.stringify(r.body))
    assert.equal(r.body.mensualidad.placa, 'LPK211')
    assert.equal(r.body.mensualidad.valor, 180000)
    assert.equal(r.body.mensualidad.fecha_fin, calcularFechaFin(hoy()))
    assert.equal(r.body.pago.cambio, 20000)
    assert.equal((await api('post', '/api/mensualidades', ctx.admin, datos)).status, 409)
    assert.equal((await api('post', '/api/mensualidades', ctx.admin, { ...datos, placa: 'NEW001', efectivo_recibido: 1000 })).status, 400)
    assert.equal((await api('post', '/api/mensualidades', ctx.admin, { ...datos, placa: 'NEW002', fecha_inicio: '2026-02-30' })).status, 400)

    const entrada = await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'LPK211', codigo_espacio: 'C-01' })
    assert.equal(entrada.status, 201)
    const salida = await api('post', `/api/movimientos/${entrada.body.id_movimiento}/salida`, ctx.trabajador, {})
    assert.equal(salida.status, 200, JSON.stringify(salida.body))
    assert.equal(salida.body.cobro.regla, 'MENSUALIDAD')
    assert.equal(salida.body.cobro.total, 0)
    assert.equal(salida.body.pago, null)
  })

  test('15. calcular fecha de fin (RC-07)', async () => {
    const r = await api('get', '/api/mensualidades/calcular-fin?fecha_inicio=2027-01-31', ctx.trabajador)
    assert.equal(r.status, 200)
    assert.equal(r.body.fecha_fin, '2027-02-28')
    const r2 = await api('get', '/api/mensualidades/calcular-fin?fecha_inicio=2026-10-01', ctx.trabajador)
    assert.equal(r2.body.fecha_fin, '2026-10-31')
  })

  test('16 y 17. estados POR VENCER y VENCIDA (RC-10)', async () => {
    const [carro] = await query(`SELECT id_tipo_vehiculo FROM tipos_vehiculo WHERE nombre = 'CARRO'`)
    const crearHistorica = async (placa, inicio, fin) => {
      const v = await query(`INSERT INTO vehiculos (placa, id_tipo_vehiculo, id_cliente) VALUES (?, ?, ?)`, [placa, carro.id_tipo_vehiculo, ctx.cliente])
      await query(
        `INSERT INTO mensualidades (id_vehiculo, id_cliente, fecha_inicio, fecha_fin, valor) VALUES (?, ?, ?, ?, 180000)`,
        [v.insertId, ctx.cliente, inicio, fin],
      )
    }
    await crearHistorica('PVN001', diaRelativo(-26), diaRelativo(3))
    await crearHistorica('VEN001', diaRelativo(-31), diaRelativo(-1))

    const r = await api('get', '/api/mensualidades', ctx.trabajador)
    assert.equal(r.status, 200)
    const estado = (placa) => r.body.mensualidades.find((m) => m.placa === placa).estado
    assert.equal(estado('LPK211'), 'ACTIVA')
    assert.equal(estado('PVN001'), 'POR VENCER')
    assert.equal(estado('VEN001'), 'VENCIDA')
    assert.deepEqual(r.body.resumen, { total: 3, activas: 1, por_vencer: 1, vencidas: 1 })
    const [guardada] = await query(`SELECT m.estado FROM mensualidades m JOIN vehiculos v USING (id_vehiculo) WHERE v.placa = 'VEN001'`)
    assert.equal(guardada.estado, 'VENCIDA')
    const filtro = await api('get', '/api/mensualidades?estado=por_vencer', ctx.trabajador)
    assert.deepEqual(filtro.body.mensualidades.map((m) => m.placa), ['PVN001'])
  })

  test('el Trabajador solo ve su historial y el panel resume la operación', async () => {
    const laura = await login('laura', 'Clave-Segura-1')
    const vacio = await api('get', '/api/movimientos/historial', laura)
    assert.equal(vacio.status, 200)
    assert.equal(vacio.body.length, 0)
    const admin = await api('get', '/api/movimientos/historial', ctx.admin)
    assert.ok(admin.body.length >= 3)

    const panel = await api('get', '/api/panel', ctx.admin)
    assert.equal(panel.status, 200)
    assert.equal(panel.body.indicadores.vehiculos_dentro, 1)
    assert.ok(panel.body.indicadores.recaudado_hoy >= 15000)
  })

  test('usuarios: estado, rol y protección del último administrador', async () => {
    const [admin] = await query(`SELECT id_usuario FROM usuarios WHERE usuario = 'admin'`)
    const [laura] = await query(`SELECT id_usuario FROM usuarios WHERE usuario = 'laura'`)
    assert.equal((await api('patch', `/api/usuarios/${admin.id_usuario}/estado`, ctx.admin, { estado: 'INACTIVO' })).status, 409)
    assert.equal((await api('put', `/api/usuarios/${admin.id_usuario}`, ctx.admin, { rol: 'TRABAJADOR' })).status, 409)

    const lauraToken = await login('laura', 'Clave-Segura-1')
    const inactiva = await api('patch', `/api/usuarios/${laura.id_usuario}/estado`, ctx.admin, { estado: 'INACTIVO' })
    assert.equal(inactiva.status, 200, JSON.stringify(inactiva.body))
    assert.equal((await api('get', '/api/panel', lauraToken)).status, 401)
    assert.equal((await api('post', '/api/auth/login', null, { usuario: 'laura', contrasena: 'Clave-Segura-1' })).status, 401)

    const ascendida = await api('put', `/api/usuarios/${laura.id_usuario}`, ctx.admin, { rol: 'ADMINISTRADOR' })
    assert.equal(ascendida.status, 200)
    assert.equal(ascendida.body.rol, 'ADMINISTRADOR')
  })

  test('tarifas: solo cambios desde hoy y sin valores negativos', async () => {
    const pasada = await api('put', '/api/tarifas', ctx.admin, { vigente_desde: diaRelativo(-1), tarifas: [{ tipo: 'CARRO', concepto: 'HORA', valor: 6000 }] })
    assert.equal(pasada.status, 400)
    const negativa = await api('put', '/api/tarifas', ctx.admin, { vigente_desde: diaRelativo(1), tarifas: [{ tipo: 'CARRO', concepto: 'HORA', valor: -1 }] })
    assert.equal(negativa.status, 400)
    const futura = await api('put', '/api/tarifas', ctx.admin, { vigente_desde: diaRelativo(1), tarifas: [{ tipo: 'CARRO', concepto: 'HORA', valor: 6000 }] })
    assert.equal(futura.status, 200, JSON.stringify(futura.body))
    const hoyVig = await api('get', '/api/tarifas/vigentes', ctx.admin)
    assert.equal(hoyVig.body.tarifas.CARRO.HORA, 5000)
    const manana = await api('get', `/api/tarifas/vigentes?fecha=${diaRelativo(1)}`, ctx.admin)
    assert.equal(manana.body.tarifas.CARRO.HORA, 6000)
  })

  test('cierre de turno con lo recaudado', async () => {
    const r = await api('post', `/api/turnos/${ctx.turnoTrabajador}/cerrar`, ctx.trabajador)
    assert.equal(r.status, 200)
    assert.equal(r.body.recaudado, 15000)
    assert.equal((await api('post', '/api/movimientos/entrada', ctx.trabajador, { placa: 'XYZ789', tipo: 'CARRO', codigo_espacio: 'C-12' })).status, 409)
  })
})
