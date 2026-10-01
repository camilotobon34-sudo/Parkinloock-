import { alertas } from '../api/index.js'
import { Badge, Cabecera, Cargando, MensajeError, Vacio } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { fechaHora } from '../utils/format.js'

const TIPO = { RESERVA_POR_VENCER: 'Reserva por vencer', SENSOR: 'Sensor' }

export default function Alertas() {
  const notificar = useToast()
  const lista = useCarga(() => alertas.activas())

  async function atender(a) {
    try {
      await alertas.atender(a.id_alerta)
      notificar('Alerta atendida.')
      lista.recargar()
    } catch (err) {
      notificar(err.message, 'error')
    }
  }

  return (
    <>
      <Cabecera titulo="Alertas" subtitulo="Alertas operativas activas">
        <button className="btn" onClick={lista.recargar}>
          Actualizar
        </button>
      </Cabecera>
      <section className="tarjeta">
        <MensajeError error={lista.error} reintentar={lista.recargar} />
        {lista.cargando && !lista.data ? (
          <Cargando />
        ) : lista.data?.length ? (
          <ul className="lista">
            {lista.data.map((a) => (
              <li key={a.id_alerta}>
                <div>
                  <Badge tono="amarillo">{TIPO[a.tipo] ?? a.tipo}</Badge> <strong>{a.mensaje}</strong>
                  <small className="muted">{fechaHora(a.fecha_hora)}</small>
                </div>
                <button className="btn btn-sm" onClick={() => atender(a)}>
                  Marcar atendida
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>No hay alertas activas.</Vacio>
        )}
      </section>
    </>
  )
}
