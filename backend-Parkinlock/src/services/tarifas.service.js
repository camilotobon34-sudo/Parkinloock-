import { query, transaction } from '../config/db.js'
import { CONCEPTOS } from '../utils/cobro.js'
import { badRequest, conflict } from '../utils/errors.js'
import { fechaLocal } from '../utils/fechas.js'
import { fecha, monto, opcion } from '../utils/validar.js'

const SQL_VIGENTES = `
  SELECT tv.id_tipo_vehiculo, tv.nombre AS tipo, t.concepto, t.valor, t.vigente_desde
    FROM tarifas t
    JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = t.id_tipo_vehiculo
   WHERE t.vigente_desde = (SELECT MAX(t2.vigente_desde) FROM tarifas t2
                             WHERE t2.id_tipo_vehiculo = t.id_tipo_vehiculo
                               AND t2.concepto = t.concepto
                               AND t2.vigente_desde <= ?)`

/** RC-09: tarifas vigentes en la fecha indicada (la más reciente que no sea posterior). */
export async function vigentes(fechaCobro = fechaLocal()) {
  const filas = await query(`${SQL_VIGENTES} ORDER BY tv.id_tipo_vehiculo, FIELD(t.concepto, ${CONCEPTOS.map(() => '?').join(',')})`, [fechaCobro, ...CONCEPTOS])
  const porTipo = {}
  for (const f of filas) (porTipo[f.tipo] ??= {})[f.concepto] = f.valor
  return { fecha: fechaCobro, tarifas: porTipo, detalle: filas }
}

/** Tarifas vigentes de un tipo de vehículo como { HORA, FRACCION, ... }; exige las 6. */
export async function vigentesPorTipo(idTipo, fechaCobro, conn) {
  const filas = await query(`${SQL_VIGENTES} AND t.id_tipo_vehiculo = ?`, [fechaCobro, idTipo], conn)
  const tarifas = Object.fromEntries(filas.map((f) => [f.concepto, f.valor]))
  const faltan = CONCEPTOS.filter((c) => tarifas[c] === undefined)
  if (faltan.length) throw conflict(`No hay tarifa vigente configurada para: ${faltan.join(', ')}.`)
  return tarifas
}

export function historial() {
  return query(
    `SELECT t.id_tarifa, tv.nombre AS tipo, t.concepto, t.valor, t.vigente_desde
       FROM tarifas t JOIN tipos_vehiculo tv ON tv.id_tipo_vehiculo = t.id_tipo_vehiculo
      ORDER BY t.vigente_desde DESC, tv.id_tipo_vehiculo, t.concepto`,
  )
}

/**
 * RF-017: el Administrador registra nuevos valores. Se guardan con su fecha de vigencia
 * para conservar el historial (RC-09); no se permiten fechas pasadas.
 */
export async function configurar(body = {}) {
  const vigenteDesde = fecha(body.vigente_desde ?? fechaLocal(), 'vigente_desde')
  if (vigenteDesde < fechaLocal()) throw badRequest('vigente_desde no puede ser una fecha pasada.')
  if (!Array.isArray(body.tarifas) || body.tarifas.length === 0) throw badRequest('Debe enviar la lista de tarifas.')

  return transaction(async (conn) => {
    const tipos = await query(`SELECT id_tipo_vehiculo, nombre FROM tipos_vehiculo`, [], conn)
    const idPorTipo = Object.fromEntries(tipos.map((t) => [t.nombre, t.id_tipo_vehiculo]))
    for (const [i, t] of body.tarifas.entries()) {
      const tipo = opcion(t?.tipo, `tarifas[${i}].tipo`, Object.keys(idPorTipo))
      const concepto = opcion(t?.concepto, `tarifas[${i}].concepto`, CONCEPTOS)
      const valor = monto(t?.valor, `tarifas[${i}].valor`)
      await query(
        `INSERT INTO tarifas (id_tipo_vehiculo, concepto, valor, vigente_desde) VALUES (?, ?, ?, ?) AS nueva
         ON DUPLICATE KEY UPDATE valor = nueva.valor`,
        [idPorTipo[tipo], concepto, valor, vigenteDesde],
        conn,
      )
    }
    return { vigente_desde: vigenteDesde, actualizadas: body.tarifas.length }
  })
}
