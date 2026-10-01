import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { movimientos, pagos } from '../api/index.js'
import { TurnoRequerido } from '../components/Turno.jsx'
import { Aviso, Badge, Cabecera, Cargando, MensajeError, Vacio } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, duracion, fechaCorta, hora, NOMBRE_CONCEPTO, NOMBRE_REGLA, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'

const PASOS = ['Entrada', 'Placa y espacio', 'Calcular tiempo', 'Cobrar', 'Cambio', 'Registrar salida', 'Liberar espacio']

export default function Salida() {
  const { turno } = useAuth()
  const notificar = useToast()
  const [params, setParams] = useSearchParams()
  const [placa, setPlaca] = useState(params.get('placa') ?? '')
  const [activo, setActivo] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState(null)
  const [efectivo, setEfectivo] = useState('')
  const [cambio, setCambio] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [comprobante, setComprobante] = useState(null)
  const dentro = useCarga(() => movimientos.enOperacion())

  async function buscar(valor = placa) {
    const p = normalizarPlaca(valor)
    setPlaca(p)
    setActivo(null)
    setCambio(null)
    setEfectivo('')
    setError(null)
    setErrorBusqueda(null)
    setComprobante(null)
    if (!p) return
    setParams({ placa: p }, { replace: true })
    setBuscando(true)
    try {
      setActivo(await movimientos.activoPorPlaca(p))
    } catch (err) {
      setErrorBusqueda(err.message)
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => {
    if (params.get('placa')) buscar(params.get('placa'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = activo?.cobro.total ?? 0

  useEffect(() => {
    if (!activo || total === 0 || efectivo === '') return setCambio(null)
    const t = setTimeout(() => {
      pagos
        .calcularCambio(total, Number(efectivo))
        .then(setCambio)
        .catch((err) => setCambio({ error: err.message }))
    }, 250)
    return () => clearTimeout(t)
  }, [efectivo, total, activo])

  async function registrarSalida() {
    setError(null)
    setEnviando(true)
    try {
      const r = await movimientos.registrarSalida(activo.movimiento.id_movimiento, total > 0 ? Number(efectivo) : undefined)
      setComprobante(r)
      setActivo(null)
      setEfectivo('')
      setCambio(null)
      notificar(`Salida de ${r.movimiento.placa} registrada. Espacio ${r.espacio.codigo} disponible.`)
      dentro.recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const paso = comprobante ? 7 : !activo ? 2 : total === 0 ? 6 : cambio?.suficiente ? 6 : efectivo ? 5 : 4
  const puedeSalir = activo && turno && (total === 0 || cambio?.suficiente)

  return (
    <>
      <Cabecera titulo="Cobrar salida" subtitulo="Busque la placa, cobre en efectivo y libere el espacio" />
      <div className="pasos tarjeta">
        {PASOS.map((p, i) => (
          <div key={p} className={`paso ${i + 1 < paso ? 'hecho' : i + 1 === paso ? 'actual' : ''}`}>
            <span>{i + 1 < paso ? '✓' : i + 1}</span>
            <small>{p}</small>
          </div>
        ))}
      </div>
      <TurnoRequerido>{null}</TurnoRequerido>

      <form
        className="buscador"
        onSubmit={(e) => {
          e.preventDefault()
          buscar()
        }}
      >
        <label>Buscar vehículo por placa</label>
        <div className="buscador-fila">
          <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="ABC123" className="input-placa" />
          <button className="btn btn-primario" disabled={buscando}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
      </form>
      {errorBusqueda && <Aviso tipo="error">{errorBusqueda}</Aviso>}

      {comprobante && <Comprobante r={comprobante} />}

      {activo && (
        <div className="rejilla-2 rejilla-salida">
          <div className="columna">
            <section className="tarjeta">
              <div className="vehiculo-cab">
                <span className="vehiculo-icono">{activo.movimiento.tipo === 'MOTO' ? '🏍' : '🚗'}</span>
                <div>
                  <h2 className="placa">{activo.movimiento.placa}</h2>
                  <small className="muted">{NOMBRE_TIPO[activo.movimiento.tipo]}</small>
                </div>
                <Badge tono="rojo">OCUPANDO {activo.movimiento.espacio}</Badge>
              </div>
              <div className="datos-3">
                <div className="dato">
                  <small>Entrada registrada</small>
                  <strong>{hora(activo.movimiento.fecha_hora_entrada)}</strong>
                  <small>{fechaCorta(activo.movimiento.fecha_hora_entrada)}</small>
                </div>
                <div className="dato">
                  <small>Salida calculada</small>
                  <strong>{hora(activo.salida_calculada)}</strong>
                  <small>Hora actual</small>
                </div>
                <div className="dato dato-destacado">
                  <small>Tiempo utilizado</small>
                  <strong>{duracion(activo.cobro.minutos)}</strong>
                  <small>{NOMBRE_REGLA[activo.cobro.regla]}</small>
                </div>
              </div>
            </section>
            <section className="tarjeta">
              <h2>Cálculo del cobro</h2>
              {activo.cobro.mensualidad ? (
                <Aviso tipo="ok">
                  Mensualidad vigente del {fechaCorta(activo.cobro.mensualidad.fecha_inicio)} al {fechaCorta(activo.cobro.mensualidad.fecha_fin)}: no se cobra por horas.
                </Aviso>
              ) : (
                <ul className="desglose">
                  {activo.cobro.desglose.map((d) => (
                    <li key={d.concepto + (d.minutos ?? '')}>
                      <span>
                        {NOMBRE_CONCEPTO[d.concepto]} {d.minutos !== undefined ? `· ${d.minutos} min` : `× ${d.cantidad}`}
                      </span>
                      <strong>{dinero(d.valor)}</strong>
                    </li>
                  ))}
                  {activo.cobro.regla !== 'POR_HORAS' && (
                    <li className="muted">
                      <span>
                        Por horas {dinero(activo.cobro.valorPorHoras)} · se aplica {NOMBRE_REGLA[activo.cobro.regla]}
                      </span>
                    </li>
                  )}
                </ul>
              )}
              <div className="total">
                <span>Total a pagar</span>
                <strong>{dinero(total)}</strong>
              </div>
            </section>
          </div>
          <section className="tarjeta">
            <div className="tarjeta-cab">
              <h2>Recibir pago</h2>
              <Badge>EFECTIVO</Badge>
            </div>
            <div className="total">
              <span>Total</span>
              <strong>{dinero(total)}</strong>
            </div>
            {total > 0 && (
              <>
                <label className="campo">
                  <span className="campo-etiqueta">Efectivo recibido</span>
                  <input type="number" min="0" step="100" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} placeholder="20000" autoFocus />
                </label>
                {cambio?.suficiente && (
                  <div className="cambio">
                    <small>Cambio para el cliente</small>
                    <strong>{dinero(cambio.cambio)}</strong>
                  </div>
                )}
                {cambio && cambio.suficiente === false && (
                  <Aviso tipo="error">
                    Con {dinero(cambio.efectivo_recibido)}, faltan {dinero(cambio.faltante)} para completar.
                  </Aviso>
                )}
                {cambio?.error && <Aviso tipo="error">{cambio.error}</Aviso>}
              </>
            )}
            {error && <Aviso tipo="error">{error}</Aviso>}
            <button className="btn btn-verde btn-bloque btn-grande" disabled={!puedeSalir || enviando} onClick={registrarSalida}>
              {enviando ? 'Registrando…' : `Registrar salida y liberar ${activo.movimiento.espacio}`}
            </button>
            <Aviso tipo="advertencia">
              Al confirmar se registrará la salida{total > 0 && `, el pago de ${dinero(total)}`} y el espacio {activo.movimiento.espacio} pasará de ocupado a
              disponible.
            </Aviso>
          </section>
        </div>
      )}

      <section className="tarjeta">
        <div className="tarjeta-cab">
          <h2>Vehículos en operación</h2>
          <button className="btn btn-sm" onClick={dentro.recargar}>
            Actualizar
          </button>
        </div>
        <MensajeError error={dentro.error} />
        {dentro.cargando && !dentro.data ? (
          <Cargando />
        ) : dentro.data?.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Tipo</th>
                  <th>Espacio</th>
                  <th>Entrada</th>
                  <th>Permanencia</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {dentro.data.map((m) => (
                  <tr key={m.id_movimiento}>
                    <td className="placa">{m.placa}</td>
                    <td>{NOMBRE_TIPO[m.tipo]}</td>
                    <td>{m.espacio}</td>
                    <td>{hora(m.fecha_hora_entrada)}</td>
                    <td>{duracion(m.permanencia_min)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => buscar(m.placa)}>
                        Cobrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay vehículos dentro del parqueadero.</Vacio>
        )}
      </section>
    </>
  )
}

function Comprobante({ r }) {
  return (
    <section className="tarjeta comprobante">
      <h3>✔ Salida registrada</h3>
      <div className="datos-3">
        <div className="dato">
          <small>Vehículo</small>
          <strong className="placa">{r.movimiento.placa}</strong>
          <small>{NOMBRE_TIPO[r.movimiento.tipo]}</small>
        </div>
        <div className="dato">
          <small>Permanencia</small>
          <strong>{duracion(r.movimiento.minutos)}</strong>
          <small>
            {hora(r.movimiento.fecha_hora_entrada)} – {hora(r.movimiento.fecha_hora_salida)}
          </small>
        </div>
        <div className="dato dato-destacado">
          <small>Total cobrado</small>
          <strong>{dinero(r.movimiento.valor_total)}</strong>
          <small>{NOMBRE_REGLA[r.cobro.regla]}</small>
        </div>
      </div>
      {r.pago ? (
        <p>
          Pago #{r.pago.id_pago} en efectivo: recibido {dinero(r.pago.efectivo_recibido)}, cambio <strong>{dinero(r.pago.cambio)}</strong>.
        </p>
      ) : (
        <p>Sin pago: vehículo con mensualidad vigente.</p>
      )}
      <p>
        Espacio <strong>{r.espacio.codigo}</strong> → <Badge tono="verde">DISPONIBLE</Badge>
      </p>
      <button className="btn btn-sm" onClick={() => window.print()}>
        Imprimir comprobante
      </button>
    </section>
  )
}
