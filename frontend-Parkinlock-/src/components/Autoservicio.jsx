import { useEffect, useState } from 'react'
import { getKioscoToken, kiosco } from '../api/index.js'
import { fechaCorta, hora, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'

const ICONO = { CARRO: '🚗', MOTO: '🏍' }
const TIPOS_BASE = [
  { id_tipo_vehiculo: 'CARRO', nombre: 'CARRO' },
  { id_tipo_vehiculo: 'MOTO', nombre: 'MOTO' },
]
const SEGUNDOS_RECIBO = 30

/**
 * Autoservicio del cliente: placa + tipo en un solo paso y recibo de entrada.
 * Usa la sesión del trabajador que activó el modo cliente en este equipo (la entrada queda en su turno).
 */
export function Autoservicio() {
  const [estado, setEstado] = useState(getKioscoToken() ? 'verificando' : 'inactivo')
  const [tipos, setTipos] = useState(TIPOS_BASE)
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [recibo, setRecibo] = useState(null)
  const [restante, setRestante] = useState(SEGUNDOS_RECIBO)

  useEffect(() => {
    if (!getKioscoToken()) return
    kiosco
      .perfil()
      .then((p) => setEstado(p.turno_activo ? 'listo' : 'sin_turno'))
      .catch(() => setEstado(getKioscoToken() ? 'listo' : 'inactivo'))
    kiosco.tipos().then(setTipos).catch(() => {})
  }, [])

  useEffect(() => {
    if (!recibo) return
    setRestante(SEGUNDOS_RECIBO)
    const t = setInterval(() => setRestante((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [recibo])

  useEffect(() => {
    if (recibo && restante <= 0) nuevo()
  }, [restante, recibo])

  function nuevo() {
    setRecibo(null)
    setPlaca('')
    setTipo(null)
    setError(null)
  }

  async function ingresar(e) {
    e.preventDefault()
    const p = normalizarPlaca(placa)
    setPlaca(p)
    setError(null)
    if (!/^[A-Z0-9]{3,10}$/.test(p)) return setError('Escriba una placa válida (letras y números).')
    if (!tipo) return setError('Seleccione si es carro o moto.')
    setEnviando(true)
    try {
      try {
        const v = await kiosco.buscarPorPlaca(p)
        if (v.en_parqueadero) throw new Error(`El vehículo ${p} ya está dentro del parqueadero (espacio ${v.movimiento_abierto.espacio}).`)
        if (v.tipo !== tipo) throw new Error(`La placa ${p} está registrada como ${NOMBRE_TIPO[v.tipo].toLowerCase()}.`)
      } catch (err) {
        if (err.status !== 404) throw err
      }
      const mapa = await kiosco.mapa()
      const libre = mapa.espacios.find((x) => x.tipo === tipo && x.estado === 'DISPONIBLE')
      if (!libre) throw new Error(`No hay espacios disponibles para ${NOMBRE_TIPO[tipo].toLowerCase()}. Por favor acérquese al personal.`)
      setRecibo(await kiosco.registrarEntrada({ placa: p, tipo, id_espacio: libre.id_espacio }))
    } catch (err) {
      if (err.status === 401) setEstado('inactivo')
      else if (err.status === 409 && /turno/i.test(err.message)) setEstado('sin_turno')
      else setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (estado === 'inactivo' || estado === 'sin_turno') {
    return (
      <div className="aviso aviso-advertencia">
        {estado === 'inactivo'
          ? 'El autoservicio no está activado en este equipo. Un trabajador debe iniciar sesión, abrir su turno y entrar a "Modo cliente".'
          : 'El trabajador que activó el autoservicio no tiene un turno abierto. Pida al personal que abra el turno.'}
      </div>
    )
  }

  if (recibo) {
    return (
      <div className="autoservicio">
        <div className="recibo">
          <div className="recibo-cab">
            <img src="/logo-web.png" alt="Parqueadero" className="recibo-logo" />
            <strong>PARKINLOCK</strong>
            <span>Recibo de entrada</span>
          </div>
          <div className="recibo-ticket">Ticket N.º {String(recibo.id_movimiento).padStart(6, '0')}</div>
          <dl>
            <dt>Placa</dt>
            <dd className="placa">{recibo.placa}</dd>
            <dt>Tipo</dt>
            <dd>{NOMBRE_TIPO[recibo.tipo]}</dd>
            <dt>Espacio</dt>
            <dd className="recibo-espacio">{recibo.espacio}</dd>
            <dt>Fecha</dt>
            <dd>{fechaCorta(recibo.fecha_hora_entrada)}</dd>
            <dt>Hora de entrada</dt>
            <dd>{hora(recibo.fecha_hora_entrada)}</dd>
          </dl>
          <p className="recibo-pie">Conserve este recibo. El valor se calcula y se paga a la salida.</p>
        </div>
        <div className="acciones-kiosco">
          <button type="button" className="btn btn-grande" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
          <button type="button" className="btn btn-primario btn-grande" onClick={nuevo}>
            Nuevo ingreso
          </button>
        </div>
        <p className="muted centro">Vuelve al inicio en {restante} s.</p>
      </div>
    )
  }

  return (
    <form className="autoservicio" onSubmit={ingresar}>
      <label className="campo">
        <span className="campo-etiqueta">Placa del vehículo</span>
        <input
          className="kiosco-placa"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          onFocus={(e) => e.target.select()}
          placeholder="ABC123"
          maxLength={12}
          autoComplete="off"
          autoFocus
        />
      </label>
      <div className="kiosco-tipos">
        {tipos.map((t) => (
          <button type="button" key={t.id_tipo_vehiculo} className={`kiosco-tipo ${tipo === t.nombre ? 'activo' : ''}`} onClick={() => setTipo(t.nombre)}>
            <span>{ICONO[t.nombre] ?? '🚘'}</span>
            {NOMBRE_TIPO[t.nombre] ?? t.nombre}
          </button>
        ))}
      </div>
      {error && <div className="aviso aviso-error">{error}</div>}
      <button className="btn btn-primario btn-grande btn-bloque" disabled={enviando || estado === 'verificando'}>
        {enviando ? 'Registrando…' : 'Ingresar y obtener recibo'}
      </button>
    </form>
  )
}
