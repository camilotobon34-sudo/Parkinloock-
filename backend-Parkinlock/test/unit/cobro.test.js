import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { calcularCobro, cobroPorHoras, dentroDeFranjaNocturna } from '../../src/utils/cobro.js'

// Tarifas vigentes del prototipo de Figma (F07).
const CARRO = { HORA: 5000, FRACCION: 5000, NOCHE: 25000, DIA: 35000, RESERVA: 8000, MENSUALIDAD: 180000 }
const MOTO = { HORA: 3000, FRACCION: 3000, NOCHE: 15000, DIA: 22000, RESERVA: 5000, MENSUALIDAD: 95000 }
const d = (dia, h, m) => new Date(2026, 9, dia, h, m)

describe('Cobros mostrados en Figma (F05 y F06)', () => {
  test('ABC123 carro 08:14–10:42 (2 h 28 min) = $15.000', () => {
    const c = calcularCobro({ entrada: d(1, 8, 14), salida: d(1, 10, 42), tarifas: CARRO })
    assert.equal(c.minutos, 148)
    assert.equal(c.total, 15000)
    assert.deepEqual(c.desglose.map((x) => x.concepto), ['HORA', 'FRACCION'])
  })
  test('RNT209 carro 08:31–10:31 (2 h) = $10.000', () => {
    assert.equal(calcularCobro({ entrada: d(1, 8, 31), salida: d(1, 10, 31), tarifas: CARRO }).total, 10000)
  })
  test('GQN54A moto 07:52–09:43 (1 h 51 min) = $6.000', () => {
    assert.equal(calcularCobro({ entrada: d(1, 7, 52), salida: d(1, 9, 43), tarifas: MOTO }).total, 6000)
  })
  test('KDM670 carro 18:10–22:04 (3 h 54 min) = $20.000, sin superar el tope Noche', () => {
    const c = calcularCobro({ entrada: d(30, 18, 10), salida: d(30, 22, 4), tarifas: CARRO })
    assert.equal(c.total, 20000)
    assert.equal(c.regla, 'POR_HORAS')
  })
})

describe('RC-01 y RC-02: horas y minutos restantes', () => {
  const t = { HORA: 5000, FRACCION: 2000 }
  test('sin minutos restantes no se cobra fracción', () => assert.equal(cobroPorHoras(120, t).valor, 10000))
  test('1 minuto restante = Fracción', () => assert.equal(cobroPorHoras(61, t).valor, 7000))
  test('30 minutos restantes = Fracción', () => assert.equal(cobroPorHoras(90, t).valor, 7000))
  test('31 minutos restantes = una Hora más', () => assert.equal(cobroPorHoras(91, t).valor, 10000))
  test('59 minutos restantes = una Hora más', () => assert.equal(cobroPorHoras(119, t).valor, 10000))
  test('0 minutos = $0', () => assert.equal(cobroPorHoras(0, t).valor, 0))
})

describe('RC-03: tope Día', () => {
  test('hasta 12 horas no supera la tarifa Día', () => {
    const c = calcularCobro({ entrada: d(1, 7, 0), salida: d(1, 15, 30), tarifas: CARRO })
    assert.equal(c.valorPorHoras, 45000)
    assert.equal(c.total, 35000)
    assert.equal(c.regla, 'TOPE_DIA')
  })
  test('más de 12 horas: un Día por bloque de 12 h más el resto', () => {
    // 13 h 20 min: 1 bloque ($35.000) + 1 h 20 min ($5.000 + Fracción $5.000)
    const c = calcularCobro({ entrada: d(1, 7, 0), salida: d(1, 20, 20), tarifas: CARRO })
    assert.equal(c.total, 45000)
  })
  test('el resto también tiene tope Día', () => {
    // 23 h 50 min: 1 bloque + 11 h 50 min (tope $35.000) = $70.000
    const c = calcularCobro({ entrada: d(1, 6, 0), salida: d(2, 5, 50), tarifas: CARRO })
    assert.equal(c.total, 70000)
  })
})

describe('RC-04: tope Noche', () => {
  test('detecta la franja 18:00–06:00 de la misma noche', () => {
    assert.equal(dentroDeFranjaNocturna(d(1, 19, 0), d(2, 5, 0)), true)
    assert.equal(dentroDeFranjaNocturna(d(1, 2, 0), d(1, 6, 0)), true)
    assert.equal(dentroDeFranjaNocturna(d(1, 19, 0), d(2, 6, 1)), false)
    assert.equal(dentroDeFranjaNocturna(d(1, 17, 59), d(1, 20, 0)), false)
  })
  test('estadía nocturna larga paga como máximo la tarifa Noche', () => {
    // 19:00–05:00 = 10 h: por horas $50.000, tope Día $35.000, tope Noche $25.000
    const c = calcularCobro({ entrada: d(1, 19, 0), salida: d(2, 5, 0), tarifas: CARRO })
    assert.equal(c.total, 25000)
    assert.equal(c.regla, 'TOPE_NOCHE')
  })
  test('fuera de la franja no aplica el tope Noche', () => {
    const c = calcularCobro({ entrada: d(1, 16, 0), salida: d(2, 2, 0), tarifas: CARRO })
    assert.equal(c.total, 35000)
  })
})

test('rechaza salida anterior a la entrada', () => {
  assert.throws(() => calcularCobro({ entrada: d(1, 10, 0), salida: d(1, 9, 0), tarifas: CARRO }), RangeError)
})
