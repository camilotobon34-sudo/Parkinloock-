import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizarPlaca, placaValida } from '../../src/utils/placa.js'

test('normaliza la placa: mayúsculas y sin espacios', () => {
  assert.equal(normalizarPlaca('abc 123'), 'ABC123')
  assert.equal(normalizarPlaca('  abc  12d '), 'ABC12D')
  assert.equal(normalizarPlaca('abc-123'), 'ABC123')
})

test('rechaza placas vacías o con caracteres no válidos', () => {
  assert.throws(() => placaValida(''), /obligatoria/)
  assert.throws(() => placaValida('   '), /obligatoria/)
  assert.throws(() => placaValida(undefined), /obligatoria/)
  assert.throws(() => placaValida('AB#123'), /letras y números/)
  assert.equal(placaValida('abc 123'), 'ABC123')
})
