import { useMemo, useState } from 'react'
import { usuarios } from '../api/index.js'
import { Aviso, Cabecera, Campo, Cargando, EstadoBadge, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { fechaHora } from '../utils/format.js'

export default function Personas() {
  const lista = useCarga(() => usuarios.personas())
  const [texto, setTexto] = useState('')
  const [registrando, setRegistrando] = useState(false)

  const filas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    const datos = lista.data ?? []
    if (!q) return datos
    return datos.filter((p) =>
      [p.nombre_completo, p.usuario, p.correo].some((v) => String(v ?? '').toLowerCase().includes(q)),
    )
  }, [lista.data, texto])

  return (
    <>
      <Cabecera
        titulo="Registro de personas"
        subtitulo={lista.data ? `${lista.data.length} persona${lista.data.length === 1 ? '' : 's'} en la base de datos` : 'Clientes registrados'}
      >
        <button className="btn btn-primario" onClick={() => setRegistrando(true)}>
          + Registrar persona
        </button>
      </Cabecera>
      <form className="filtros" onSubmit={(e) => e.preventDefault()}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre, usuario o correo" />
      </form>
      <section className="tarjeta">
        <MensajeError error={lista.error} reintentar={lista.recargar} />
        {lista.cargando && !lista.data ? (
          <Cargando />
        ) : filas.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Estado</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id_usuario}>
                    <td>{p.nombre_completo}</td>
                    <td>{p.usuario}</td>
                    <td>{p.correo ?? '—'}</td>
                    <td>
                      <EstadoBadge estado={p.estado} />
                    </td>
                    <td className="nowrap">{fechaHora(p.fecha_creacion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>{texto ? 'Ninguna persona coincide con la búsqueda.' : 'Todavía no hay personas. Regístralas aquí o desde el ingreso Cliente.'}</Vacio>
        )}
      </section>
      {registrando && (
        <PersonaModal
          onCerrar={(ok) => {
            setRegistrando(false)
            if (ok) lista.recargar()
          }}
        />
      )}
    </>
  )
}

function PersonaModal({ onCerrar }) {
  const notificar = useToast()
  const [form, setForm] = useState({ nombre_completo: '', usuario: '', correo: '', contrasena: '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await usuarios.crear({ ...form, rol: 'CLIENTE' })
      notificar('Persona registrada. Ya puede entrar como Cliente.')
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Registrar persona" onCerrar={() => onCerrar(false)}>
      <form className="form" onSubmit={guardar}>
        <Campo etiqueta="Nombre completo">
          <input value={form.nombre_completo} onChange={cambiar('nombre_completo')} maxLength={120} required />
        </Campo>
        <div className="fila-2">
          <Campo etiqueta="Usuario">
            <input value={form.usuario} onChange={cambiar('usuario')} maxLength={50} required />
          </Campo>
          <Campo etiqueta="Correo">
            <input type="email" value={form.correo} onChange={cambiar('correo')} maxLength={120} required />
          </Campo>
        </div>
        <Campo etiqueta="Contraseña" ayuda="Mínimo 8 caracteres. La usará para entrar como Cliente.">
          <input type="password" value={form.contrasena} onChange={cambiar('contrasena')} minLength={8} maxLength={72} required autoComplete="new-password" />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="acciones">
          <button type="button" className="btn" onClick={() => onCerrar(false)}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
