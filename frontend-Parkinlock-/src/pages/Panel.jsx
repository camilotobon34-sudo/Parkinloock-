import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { espacios, panel } from '../api/index.js'
import { MapaEspacios } from '../components/MapaEspacios.jsx'
import { TurnoRequerido, TurnoResumen } from '../components/Turno.jsx'
import { Cabecera, Cargando, EstadoBadge, MensajeError, Vacio } from '../components/ui.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, hora } from '../utils/format.js'

export default function Panel() {
  const resumen = useCarga(() => panel.resumen())
  const mapa = useCarga(() => espacios.mapa())

  useEffect(() => {
    const t = setInterval(() => {
      resumen.recargar()
      mapa.recargar()
    }, 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ind = resumen.data?.indicadores
  return (
    <>
      <Cabecera titulo="Panel general" subtitulo="Resumen operativo del parqueadero" />
      <div className="acciones-rapidas">
        <Link className="btn btn-primario" to="/entrada">
          → Registrar entrada
        </Link>
        <Link className="btn" to="/salida">
          $ Cobrar salida
        </Link>
        <Link className="btn" to="/reservas">
          📅 Nueva reserva
        </Link>
      </div>
      <TurnoRequerido>{null}</TurnoRequerido>
      <MensajeError error={resumen.error} reintentar={resumen.recargar} />
      {!ind && resumen.cargando ? (
        <Cargando />
      ) : (
        ind && (
          <div className="indicadores">
            <Indicador titulo="Vehículos dentro" valor={ind.vehiculos_dentro} tono="amarillo" icono="🚗" />
            <Indicador titulo="Disponibles" valor={ind.disponibles} tono="verde" icono="P" />
            <Indicador titulo="Ocupados" valor={ind.ocupados} tono="rojo" icono="⦸" />
            <Indicador titulo="Reservados" valor={ind.reservados} tono="amarillo" icono="📅" />
            <Indicador titulo="Recaudado hoy" valor={dinero(ind.recaudado_hoy)} tono="verde" icono="▤" />
          </div>
        )
      )}

      <div className="rejilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Mapa de espacios</h2>
            {ind && <span className="muted">Ocupación {ind.ocupacion_porcentaje}% · {ind.total_espacios} espacios</span>}
          </div>
          <MensajeError error={mapa.error} reintentar={mapa.recargar} />
          {mapa.data ? <MapaEspacios espacios={mapa.data.espacios} /> : <Cargando />}
        </section>
        <div className="columna">
          <section className="tarjeta">
            <div className="tarjeta-cab">
              <h2>Turno activo</h2>
            </div>
            <TurnoResumen turno={resumen.data?.turno_activo} />
          </section>
          <section className="tarjeta">
            <div className="tarjeta-cab">
              <h2>Movimientos recientes</h2>
              <Link to="/historial">Ver historial</Link>
            </div>
            {resumen.data?.ultimos_movimientos?.length ? (
              <ul className="lista">
                {resumen.data.ultimos_movimientos.map((m) => (
                  <li key={m.id_movimiento}>
                    <div>
                      <strong className="placa">{m.placa}</strong>
                      <small className="muted">
                        {m.espacio} · entrada {hora(m.fecha_hora_entrada)}
                        {m.fecha_hora_salida && ` · salida ${hora(m.fecha_hora_salida)}`}
                      </small>
                    </div>
                    <div className="derecha">
                      <EstadoBadge estado={m.estado} />
                      {m.valor_total !== null && <small>{dinero(m.valor_total)}</small>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vacio>Aún no hay movimientos.</Vacio>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

function Indicador({ titulo, valor, tono, icono }) {
  return (
    <div className="indicador">
      <div className="indicador-cab">
        <span>{titulo}</span>
        <span className={`indicador-icono tono-${tono}`}>{icono}</span>
      </div>
      <strong>{valor}</strong>
    </div>
  )
}
