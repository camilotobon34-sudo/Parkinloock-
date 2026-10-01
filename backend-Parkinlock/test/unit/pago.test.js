import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularCambio } from '../../src/utils/pago.js'

test('RC-08: cambio = efectivo recibido − valor', () => {
  assert.equal(calcularCambio(15000, 20000), 5000)
  assert.equal(calcularCambio(15000, 15000), 0)
})

test('efectivo insuficiente indica el faltante como en Figma', () => {
  assert.throws(() => calcularCambio(15000, 12000), (e) => {
    assert.equal(e.status, 400)
    assert.match(e.message, /Con \$12\.000, faltan \$3\.000 para completar/)
    assert.equal(e.detalles.faltante, 3000)
    return true
  })
})

test('rechaza valores o efectivo negativos', () => {
  assert.throws(() => calcularCambio(-1, 100), /valor/)
  assert.throws(() => calcularCambio(100, -5), /negativo/)
})
