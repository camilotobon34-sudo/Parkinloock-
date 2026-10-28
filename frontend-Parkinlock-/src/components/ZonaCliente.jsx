import { useEffect, useState } from 'react'
import { espacios, movimientos, tarifas } from '../api/index.js'
import { dinero, duracion, hora, NOMBRE_CONCEPTO, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'
import { MapaEspacios } from './MapaEspacios.jsx'

const CONCEPTOS = ['HORA', 'FRACCION', 'NOCHE', 'DIA', 'RESERVA', 'MENSUALIDAD']

export function ZonaCliente({ usuario }) {
  const [seccion, setSeccion] = useState('consultar')
  const [ahora, setAhora] = useState(new Date())
  const [placa, setPlaca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [consulta, setConsulta] = useState(null)
  const [errorConsulta, setErrorConsulta] = useState(null)
  const [mapa, setMapa] = useState(null)
  const [filtro, setFiltro] = useState('TODOS')
  const [espacio, setEspacio] = useState(null)
  const [listaTarifas, setListaTarifas] = useState(null)
  const [tipoTarifa, setTipoTarifa] = useState('CARRO')

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    espacios.mapa().then(setMapa).catch(() => {})
    tarifas.vigentes().then(setListaTarifas).catch(() => {})
  }, [])

  async function consultar(e) {
    e.preventDefault()
    const p = normalizarPlaca(placa)
    setPlaca(p)
    setErrorConsulta(null)
    setConsulta(null)
    if (!/^[A-Z0-9]{3,10}$/.test(p)) {
      setErrorConsulta('Escribe una placa válida, con letras y números.')
      return
    }
    setBuscando(true)
    try {
      setConsulta(await movimientos.activoPorPlaca(p))
    } catch (err) {
      if (err.status === 404) setConsulta({ fuera: true, placa: p })
      else setErrorConsulta(err.message)
    } finally {
      setBuscando(false)
    }
  }

  const lista = (mapa?.espacios ?? []).filter((e) => filtro === 'TODOS' || e.tipo === filtro)
  const precios = listaTarifas?.tarifas?.[tipoTarifa]
  const horaTxt = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div className="zona-cliente">
      <div>
        <h1>Hola, {usuario.nombre_completo}</h1>
        <p className="sub">
          {usuario.usuario} · {usuario.correo} · {horaTxt}
        </p>
      </div>
      <div className="segmentado roles-login">
        {[
          ['consultar', 'Consultar'],
          ['espacios', 'Espacios'],
          ['tarifas', 'Tarifas'],
        ].map(([id, texto]) => (
          <button type="button" key={id} className={seccion === id ? 'activo' : ''} onClick={() => setSeccion(id)}>
            {texto}
          </button>
        ))}
      </div>

      {seccion === 'consultar' && (
        <form className="form" onSubmit={consultar}>
          <label className="campo">
            <span className="campo-etiqueta">Placa del vehículo</span>
            <input
              className="kiosco-placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={12}
              autoComplete="off"
              autoFocus
            />
          </label>
          <button className="btn btn-primario btn-grande btn-bloque" disabled={buscando}>
            {buscando ? 'Consultando…' : 'Consultar placa'}
          </button>
          {errorConsulta && <div className="aviso aviso-error">{errorConsulta}</div>}
          {consulta?.fuera && <div className="aviso aviso-advertencia">La placa {consulta.placa} no está dentro del parqueadero.</div>}
          {consulta?.movimiento && (
            <div className="cliente-resultado">
              <strong className="placa">{consulta.movimiento.placa}</strong>
              <span>Está dentro, en el espacio {consulta.movimiento.espacio}</span>
              <dl className="datos-cliente">
                <dt>Tipo</dt>
                <dd>{NOMBRE_TIPO[consulta.movimiento.tipo] ?? consulta.movimiento.tipo}</dd>
                <dt>Entrada</dt>
                <dd>{hora(consulta.movimiento.fecha_hora_entrada)}</dd>
                <dt>Tiempo</dt>
                <dd>{duracion(consulta.cobro?.minutos)}</dd>
                <dt>A pagar</dt>
                <dd>{dinero(consulta.cobro?.total)}</dd>
              </dl>
            </div>
          )}
        </form>
      )}

      {seccion === 'espacios' && (
        <div className="zona-espacios">
          <div className="segmentado compacto">
            {[
              ['TODOS', 'Todos'],
              ['CARRO', 'Carros'],
              ['MOTO', 'Motos'],
            ].map(([id, texto]) => (
              <button type="button" key={id} className={filtro === id ? 'activo' : ''} onClick={() => { setFiltro(id); setEspacio(null) }}>
                {texto}
              </button>
            ))}
          </div>
          {mapa?.resumen && (
            <p className="muted">
              {mapa.resumen.DISPONIBLE} disponibles · {mapa.resumen.OCUPADO} ocupados · {mapa.resumen.RESERVADO} reservados
            </p>
          )}
          <MapaEspacios espacios={lista} seleccionado={espacio?.id_espacio} onSeleccionar={setEspacio} seleccionable={() => true} />
          {espacio && (
            <div className="cliente-resultado">
              <strong>{espacio.codigo}</strong>
              <span>{espacio.estado === 'DISPONIBLE' ? 'Libre para estacionar' : espacio.estado === 'OCUPADO' ? `Ocupado por ${espacio.placa}` : 'Reservado'}</span>
              {espacio.fecha_hora_entrada && <small className="muted">Entró a las {hora(espacio.fecha_hora_entrada)}</small>}
            </div>
          )}
        </div>
      )}

      {seccion === 'tarifas' && (
        <div className="zona-tarifas">
          <div className="segmentado compacto">
            {['CARRO', 'MOTO'].map((tipo) => (
              <button type="button" key={tipo} className={tipoTarifa === tipo ? 'activo' : ''} onClick={() => setTipoTarifa(tipo)}>
                {NOMBRE_TIPO[tipo]}
              </button>
            ))}
          </div>
          <ul className="lista">
            {CONCEPTOS.map((c) => (
              <li key={c}>
                <span>{NOMBRE_CONCEPTO[c]}</span>
                <strong>{precios ? dinero(precios[c]) : '…'}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
