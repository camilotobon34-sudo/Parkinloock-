export const CONCEPTOS = ['HORA', 'FRACCION', 'NOCHE', 'DIA', 'RESERVA', 'MENSUALIDAD']
export const MINUTOS_DIA = 12 * 60
export const NOCHE_INICIO = 18
export const NOCHE_FIN = 6

/** RC-01 y RC-02: horas completas con tarifa Hora y minutos restantes como Fracción u Hora. */
export function cobroPorHoras(minutos, tarifas) {
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  let valor = horas * tarifas.HORA
  let cargoResto = null
  if (resto >= 1 && resto <= 30) {
    valor += tarifas.FRACCION
    cargoResto = 'FRACCION'
  } else if (resto > 30) {
    valor += tarifas.HORA
    cargoResto = 'HORA'
  }
  return { horas, resto, cargoResto, valor }
}

/** RC-04: entrada y salida dentro de la misma franja de 18:00 a 06:00. */
export function dentroDeFranjaNocturna(entrada, salida) {
  const h = entrada.getHours()
  if (h >= NOCHE_FIN && h < NOCHE_INICIO) return false
  const finFranja = new Date(entrada)
  if (h >= NOCHE_INICIO) finFranja.setDate(finFranja.getDate() + 1)
  finFranja.setHours(NOCHE_FIN, 0, 0, 0)
  return salida <= finFranja
}

/**
 * Valor de una estadía con las reglas RC-01 a RC-04.
 * `tarifas` son las vigentes para el tipo de vehículo en la fecha del cobro (RC-09).
 */
export function calcularCobro({ entrada, salida, tarifas }) {
  if (!(entrada instanceof Date) || !(salida instanceof Date) || salida < entrada) {
    throw new RangeError('La salida debe ser posterior a la entrada.')
  }
  for (const c of ['HORA', 'FRACCION', 'NOCHE', 'DIA']) {
    if (!Number.isFinite(tarifas?.[c])) throw new RangeError(`Falta la tarifa ${c}.`)
  }

  const minutos = Math.floor((salida - entrada) / 60000)
  const base = cobroPorHoras(minutos, tarifas)
  const desglose = []
  if (base.horas > 0) desglose.push({ concepto: 'HORA', cantidad: base.horas, valor: base.horas * tarifas.HORA })
  if (base.cargoResto) {
    desglose.push({ concepto: base.cargoResto, cantidad: 1, valor: tarifas[base.cargoResto], minutos: base.resto })
  }

  let total
  let regla = 'POR_HORAS'
  if (minutos <= MINUTOS_DIA) {
    total = base.valor
    if (tarifas.DIA < total) {
      total = tarifas.DIA
      regla = 'TOPE_DIA'
    }
  } else {
    const bloques = Math.floor(minutos / MINUTOS_DIA)
    const resto = cobroPorHoras(minutos - bloques * MINUTOS_DIA, tarifas)
    total = bloques * tarifas.DIA + Math.min(resto.valor, tarifas.DIA)
    regla = 'TOPE_DIA'
  }

  if (dentroDeFranjaNocturna(entrada, salida) && tarifas.NOCHE < total) {
    total = tarifas.NOCHE
    regla = 'TOPE_NOCHE'
  }

  return {
    minutos,
    horas: base.horas,
    minutosRestantes: base.resto,
    valorPorHoras: base.valor,
    desglose,
    regla,
    total,
  }
}
