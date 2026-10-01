const moneda = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

export const dinero = (v) => (v === null || v === undefined || v === '' ? '—' : moneda.format(Number(v)).replace(/\s/g, ''))

export const normalizarPlaca = (p) => String(p ?? '').replace(/[\s-]+/g, '').toUpperCase()

const pad = (n) => String(n).padStart(2, '0')

export function fechaISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const sumarDias = (dias, base = new Date()) => fechaISO(new Date(base.getTime() + dias * 86_400_000))

export function fechaHoraInput(d = new Date()) {
  return `${fechaISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function hora(v) {
  if (!v) return '—'
  const d = new Date(v)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fechaCorta(v) {
  if (!v) return '—'
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const fechaHora = (v) => (v ? `${fechaCorta(v)} ${hora(v)}` : '—')

export function duracion(min) {
  if (min === null || min === undefined) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h} h ${m} min` : `${m} min`
}

export const horaCorta = (t) => (t ? String(t).slice(0, 5) : '—')

export function exportarCSV(nombre, filas, columnas) {
  const escapar = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lineas = [columnas.map((c) => escapar(c.titulo)).join(';')]
  for (const f of filas) lineas.push(columnas.map((c) => escapar(c.valor(f))).join(';'))
  const blob = new Blob([`\uFEFF${lineas.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}_${fechaISO()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const NOMBRE_ROL = { ADMINISTRADOR: 'Administrador', TRABAJADOR: 'Trabajador' }
export const NOMBRE_TIPO = { CARRO: 'Carro', MOTO: 'Moto' }
export const NOMBRE_REGLA = {
  POR_HORAS: 'Hora + fracción',
  TOPE_DIA: 'Tope tarifa Día',
  TOPE_NOCHE: 'Tope tarifa Noche',
  MENSUALIDAD: 'Mensualidad vigente (sin cobro)',
}
export const NOMBRE_CONCEPTO = {
  HORA: 'Hora',
  FRACCION: 'Fracción',
  NOCHE: 'Noche',
  DIA: 'Día',
  RESERVA: 'Reserva',
  MENSUALIDAD: 'Mensualidad',
}
