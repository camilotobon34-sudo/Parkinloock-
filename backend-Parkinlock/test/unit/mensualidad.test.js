import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { calcularFechaFin, estadoMensualidad } from '../../src/utils/mensualidad.js'

describe('RC-07: fecha de fin de la mensualidad', () => {
  const casos = [
    ['2026-10-01', '2026-10-31'],
    ['2026-09-01', '2026-09-30'],
    ['2026-10-15', '2026-11-14'],
    ['2027-01-31', '2027-02-28'],
    ['2027-01-29', '2027-02-28'],
    ['2027-01-28', '2027-02-27'],
    ['2028-01-30', '2028-02-29'],
    ['2026-12-31', '2027-01-30'],
    ['2026-03-31', '2026-04-30'],
  ]
  for (const [inicio, fin] of casos) test(`${inicio} → ${fin}`, () => assert.equal(calcularFechaFin(inicio), fin))
  test('rechaza fechas no válidas', () => assert.throws(() => calcularFechaFin('2026-02-30'), RangeError))
})

describe('RC-10: estado de la mensualidad', () => {
  const fin = '2026-10-31'
  test('ACTIVA si faltan más de 5 días', () => assert.equal(estadoMensualidad(fin, '2026-10-25'), 'ACTIVA'))
  test('POR VENCER si faltan 5 días', () => assert.equal(estadoMensualidad(fin, '2026-10-26'), 'POR VENCER'))
  test('POR VENCER el último día', () => assert.equal(estadoMensualidad(fin, '2026-10-31'), 'POR VENCER'))
  test('VENCIDA al día siguiente de la fecha de fin', () => assert.equal(estadoMensualidad(fin, '2026-11-01'), 'VENCIDA'))
})
