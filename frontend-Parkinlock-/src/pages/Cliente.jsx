import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { espacios, movimientos, vehiculos } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { fechaCorta, hora, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'

const ICONO = { CARRO: '🚗', MOTO: '🏍' }
const SEGUNDOS_RECIBO = 30

/**
 * Modo autoservicio: lo activa un trabajador con turno abierto en el equipo de la entrada.
 * El cliente escribe la placa, elige el tipo y recibe el recibo de entrada.
 * La entrada queda asociada al turno del trabajador que activó la pantalla.
 */
export default function Cliente() {
  const { turno } = useAuth()
  const [paso, setPaso] = useState('placa')
  const [placa, setPlaca] = useState('')
  const [tipos, setTipos] = useState([])
  const [tipoRegistrado, setTipoRegistrado] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [recibo, setRecibo] = useState(null)
  const [restante, setRestante] = useState(SEGUNDOS_RECIBO)

  useEffect(() => {
    vehiculos.tipos().then(setTipos).catch(() => setTipos([]))
  }, [])

  useEffect(() => {
    if (paso !== 'recibo') return
    setRestante(SEGUNDOS_RECIBO)
    const t = setInterval(() => setRestante((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [paso])

  useEffect(() => {
    if (paso === 'recibo' && restante <= 0) reiniciar()
  }, [restante, paso])

  function reiniciar() {
    setPaso('placa')
    setPlaca('')
    setTipoRegistrado(null)
    setError(null)
    setRecibo(null)
  }

  async function continuar(e) {
    e.preventDefault()
    const p = normalizarPlaca(placa)
    setPlaca(p)
    setError(null)
    if (!/^[A-Z0-9]{3,10}$/.test(p)) return setError('Escriba una placa válida (letras y números).')
    setEnviando(true)
    try {
      const v = await vehiculos.buscarPorPlaca(p)
      if (v.en_parqueadero) return setError(`El vehículo ${p} ya está dentro del parqueadero (espacio ${v.movimiento_abierto.espacio}).`)
      setTipoRegistrado(v.tipo)
    } catch (err) {
      if (err.status !== 404) return setError(err.message)
      setTipoRegistrado(null)
    } finally {
      setEnviando(false)
    }
    setPaso('tipo')
  }

  async function ingresar(tipo) {
    setError(null)
    setEnviando(true)
    try {
      const mapa = await espacios.mapa()
      const libre = mapa.espacios.find((e) => e.tipo === tipo && e.estado === 'DISPONIBLE')
      if (!libre) throw new Error(`No hay espacios disponibles para ${NOMBRE_TIPO[tipo].toLowerCase()} en este momento. Por favor acérquese al personal.`)
      const m = await movimientos.registrarEntrada({ placa, tipo, id_espacio: libre.id_espacio })
      setRecibo(m)
      setPaso('recibo')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!turno) {
    return (
      <div className="kiosco">
        <div className="kiosco-tarjeta">
          <h1>Modo cliente no disponible</h1>
          <p className="sub">Un trabajador debe abrir un turno antes de activar el autoservicio.</p>
          <Link className="btn btn-primario btn-grande" to="/turnos">
            Ir a Turnos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="kiosco">
      <header className="kiosco-cab">
        <div className="marca">
          <span className="marca-logo">P</span>
          <div>
            <strong>PARKINLOCK</strong>
            <small>Bienvenido</small>
          </div>
        </div>
        <Link
          to="/"
          className="kiosco-salir"
          onClick={(e) => !window.confirm('¿Salir del modo cliente?') && e.preventDefault()}
        >
          Salir del modo cliente
        </Link>
      </header>

      {paso === 'placa' && (
        <form className="kiosco-tarjeta" onSubmit={continuar}>
          <h1>Ingrese la placa de su vehículo</h1>
          <p className="sub">Escriba la placa sin espacios ni guiones.</p>
          <input
            className="kiosco-placa"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            onFocus={(e) => e.target.select()}
            placeholder="ABC123"
            maxLength={12}
            autoFocus
            autoComplete="off"
          />
          {error && <div className="aviso aviso-error">{error}</div>}
          <button className="btn btn-primario btn-grande btn-bloque" disabled={enviando || !placa.trim()}>
            {enviando ? 'Verificando…' : 'Continuar →'}
          </button>
        </form>
      )}

      {paso === 'tipo' && (
        <div className="kiosco-tarjeta">
          <h1>¿Qué tipo de vehículo es?</h1>
          <p className="sub">
            Placa <strong className="placa">{placa}</strong>
          </p>
          <div className="kiosco-tipos">
            {tipos.map((t) => (
              <button
                key={t.id_tipo_vehiculo}
                className="kiosco-tipo"
                disabled={enviando || (tipoRegistrado && tipoRegistrado !== t.nombre)}
                onClick={() => ingresar(t.nombre)}
              >
                <span>{ICONO[t.nombre] ?? '🚘'}</span>
                {NOMBRE_TIPO[t.nombre] ?? t.nombre}
              </button>
            ))}
          </div>
          {tipoRegistrado && <p className="muted">Su placa está registrada como {NOMBRE_TIPO[tipoRegistrado].toLowerCase()}.</p>}
          {enviando && <p className="muted">Asignando espacio…</p>}
          {error && <div className="aviso aviso-error">{error}</div>}
          <button className="btn btn-bloque" onClick={reiniciar} disabled={enviando}>
            ← Volver
          </button>
        </div>
      )}

      {paso === 'recibo' && recibo && (
        <div className="kiosco-tarjeta">
          <div className="recibo" id="recibo">
            <div className="recibo-cab">
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
            <button className="btn btn-grande" onClick={() => window.print()}>
              🖨 Imprimir recibo
            </button>
            <button className="btn btn-primario btn-grande" onClick={reiniciar}>
              Nuevo ingreso
            </button>
          </div>
          <p className="muted centro">La pantalla volverá al inicio en {restante} s.</p>
        </div>
      )}
    </div>
  )
}
