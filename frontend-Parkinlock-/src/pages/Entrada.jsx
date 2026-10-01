import { useState } from 'react'
import { Link } from 'react-router-dom'
import { espacios, movimientos, vehiculos } from '../api/index.js'
import { MapaEspacios } from '../components/MapaEspacios.jsx'
import { TurnoRequerido } from '../components/Turno.jsx'
import { Aviso, Badge, Cabecera, Campo, Cargando, MensajeError } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { fechaCorta, hora, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'

export default function Entrada() {
  const { turno } = useAuth()
  const notificar = useToast()
  const tipos = useCarga(() => vehiculos.tipos())
  const mapa = useCarga(() => espacios.mapa())
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState('')
  const [espacio, setEspacio] = useState(null)
  const [busqueda, setBusqueda] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [registrado, setRegistrado] = useState(null)

  async function buscar() {
    const p = normalizarPlaca(placa)
    setPlaca(p)
    setBusqueda(null)
    setError(null)
    if (!p) return
    try {
      const v = await vehiculos.buscarPorPlaca(p)
      setBusqueda({ encontrado: true, vehiculo: v })
      setTipo(v.tipo)
      if (espacio && espacio.tipo !== v.tipo) setEspacio(null)
    } catch (err) {
      if (err.status === 404) setBusqueda({ encontrado: false })
      else setError(err.message)
    }
  }

  async function registrar(e) {
    e.preventDefault()
    setError(null)
    const p = normalizarPlaca(placa)
    if (!p) return setError('Ingrese la placa.')
    if (!tipo) return setError('Seleccione el tipo de vehículo.')
    if (!espacio) return setError('Seleccione un espacio disponible en el mapa.')
    setEnviando(true)
    try {
      const m = await movimientos.registrarEntrada({ placa: p, tipo, id_espacio: espacio.id_espacio })
      setRegistrado(m)
      notificar(`Entrada de ${m.placa} registrada en ${m.espacio}.`)
      setPlaca('')
      setEspacio(null)
      setBusqueda(null)
      mapa.recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const yaDentro = busqueda?.vehiculo?.en_parqueadero
  return (
    <>
      <Cabecera titulo="Registrar entrada" subtitulo="Placa, tipo de vehículo y espacio" />
      <TurnoRequerido>{null}</TurnoRequerido>
      <div className="rejilla-2">
        <form className="tarjeta form" onSubmit={registrar}>
          <h2>Datos del vehículo</h2>
          <Campo etiqueta="Placa" ayuda="Se guarda en mayúsculas y sin espacios (abc 123 → ABC123).">
            <div className="input-con-boton">
              <input
                className="input-placa"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                onBlur={buscar}
                placeholder="ABC123"
                maxLength={12}
                required
              />
              <button type="button" className="btn btn-sm" onClick={buscar}>
                Buscar
              </button>
            </div>
          </Campo>
          {busqueda?.encontrado && (
            <Aviso tipo={yaDentro ? 'error' : 'ok'}>
              <span>
                <strong>{busqueda.vehiculo.placa}</strong> registrado como {NOMBRE_TIPO[busqueda.vehiculo.tipo]}
                {busqueda.vehiculo.cliente && ` · ${busqueda.vehiculo.cliente}`}
                {yaDentro &&
                  ` · ya está dentro en ${busqueda.vehiculo.movimiento_abierto.espacio} desde las ${hora(busqueda.vehiculo.movimiento_abierto.fecha_hora_entrada)}`}
              </span>
              {busqueda.vehiculo.mensualidad_vigente && (
                <Badge tono="verde">Mensualidad hasta {fechaCorta(busqueda.vehiculo.mensualidad_vigente.fecha_fin)}</Badge>
              )}
            </Aviso>
          )}
          {busqueda && !busqueda.encontrado && (
            <Aviso tipo="info">Vehículo nuevo: se registrará con el tipo seleccionado.</Aviso>
          )}
          <Campo etiqueta="Tipo de vehículo">
            <div className="segmentado">
              {(tipos.data ?? []).map((t) => (
                <button
                  type="button"
                  key={t.id_tipo_vehiculo}
                  className={tipo === t.nombre ? 'activo' : ''}
                  disabled={busqueda?.encontrado && busqueda.vehiculo.tipo !== t.nombre}
                  onClick={() => {
                    setTipo(t.nombre)
                    if (espacio && espacio.tipo !== t.nombre) setEspacio(null)
                  }}
                >
                  {NOMBRE_TIPO[t.nombre] ?? t.nombre}
                </button>
              ))}
            </div>
          </Campo>
          <Campo etiqueta="Espacio">
            <input readOnly value={espacio ? espacio.codigo : ''} placeholder="Seleccione en el mapa" />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <button className="btn btn-primario btn-bloque btn-grande" disabled={enviando || !turno || yaDentro}>
            {enviando ? 'Registrando…' : 'Registrar entrada'}
          </button>
          {registrado && (
            <div className="comprobante">
              <h3>✔ Entrada registrada</h3>
              <p>
                <strong className="placa">{registrado.placa}</strong> · {NOMBRE_TIPO[registrado.tipo]} · espacio{' '}
                <strong>{registrado.espacio}</strong>
              </p>
              <p className="muted">
                {fechaCorta(registrado.fecha_hora_entrada)} {hora(registrado.fecha_hora_entrada)}
              </p>
              <Link to="/" className="btn btn-sm">
                Ver panel
              </Link>
            </div>
          )}
        </form>
        <section className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Seleccione un espacio {tipo && `para ${NOMBRE_TIPO[tipo]?.toLowerCase()}`}</h2>
          </div>
          <MensajeError error={mapa.error} reintentar={mapa.recargar} />
          {mapa.data ? (
            <MapaEspacios
              espacios={mapa.data.espacios}
              seleccionado={espacio?.id_espacio}
              onSeleccionar={setEspacio}
              seleccionable={(e) => (e.estado === 'DISPONIBLE' || e.estado === 'RESERVADO') && (!tipo || e.tipo === tipo)}
            />
          ) : (
            <Cargando />
          )}
          <p className="muted">Los espacios reservados solo se pueden ocupar con el vehículo de la reserva confirmada.</p>
        </section>
      </div>
    </>
  )
}
