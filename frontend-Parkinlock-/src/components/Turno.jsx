import { useState } from 'react'
import { turnos } from '../api/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { dinero, fechaHoraInput, hora } from '../utils/format.js'
import { Aviso, Campo, Modal } from './ui.jsx'

export function AbrirTurnoModal({ onCerrar, idUsuario }) {
  const { refrescar } = useAuth()
  const notificar = useToast()
  const ahora = new Date()
  const [form, setForm] = useState({
    caja: 'Caja 1',
    inicio_programado: fechaHoraInput(ahora),
    fin_programado: fechaHoraInput(new Date(ahora.getTime() + 8 * 3_600_000)),
    caja_inicial: 0,
  })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function enviar(e) {
    e.preventDefault()
    e.stopPropagation()
    setEnviando(true)
    setError(null)
    try {
      await turnos.abrir({ ...form, caja_inicial: Number(form.caja_inicial || 0), id_usuario: idUsuario })
      await refrescar()
      notificar('Turno abierto.')
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Abrir turno" onCerrar={() => onCerrar(false)}>
      <form onSubmit={enviar} className="form">
        <Campo etiqueta="Caja">
          <input value={form.caja} onChange={cambiar('caja')} maxLength={20} required />
        </Campo>
        <div className="fila-2">
          <Campo etiqueta="Inicio programado">
            <input type="datetime-local" value={form.inicio_programado} onChange={cambiar('inicio_programado')} required />
          </Campo>
          <Campo etiqueta="Fin programado">
            <input type="datetime-local" value={form.fin_programado} onChange={cambiar('fin_programado')} required />
          </Campo>
        </div>
        <Campo etiqueta="Caja inicial (efectivo)">
          <input type="number" min="0" step="100" value={form.caja_inicial} onChange={cambiar('caja_inicial')} />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="acciones">
          <button type="button" className="btn" onClick={() => onCerrar(false)}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Abriendo…' : 'Abrir turno'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Bloque que se muestra en las pantallas de caja cuando el usuario no tiene turno abierto. */
export function TurnoRequerido({ children }) {
  const { turno } = useAuth()
  const [abrir, setAbrir] = useState(false)
  if (turno) return children
  return (
    <>
      <Aviso tipo="advertencia">
        <span>Debe abrir un turno antes de registrar entradas, salidas o pagos.</span>
        <button className="btn btn-sm btn-primario" onClick={() => setAbrir(true)}>
          Abrir turno
        </button>
      </Aviso>
      {abrir && <AbrirTurnoModal onCerrar={() => setAbrir(false)} />}
    </>
  )
}

export function TurnoResumen({ turno }) {
  if (!turno) return <span className="muted">Sin turno abierto</span>
  return (
    <span>
      {turno.caja} · {hora(turno.inicio_programado)}–{hora(turno.fin_programado)} · base {dinero(turno.caja_inicial)}
    </span>
  )
}
