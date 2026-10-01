import { useState } from 'react'
import { clientes } from '../api/index.js'
import { Aviso, Cabecera, Campo, Cargando, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'

export default function Clientes() {
  const [texto, setTexto] = useState('')
  const [buscar, setBuscar] = useState('')
  const lista = useCarga(() => clientes.listar({ buscar, limit: 200 }), [buscar])
  const [editando, setEditando] = useState(null)

  return (
    <>
      <Cabecera titulo="Clientes" subtitulo="Titulares de reservas, mensualidades y vehículos">
        <button className="btn btn-primario" onClick={() => setEditando({})}>
          + Nuevo cliente
        </button>
      </Cabecera>
      <form
        className="filtros"
        onSubmit={(e) => {
          e.preventDefault()
          setBuscar(texto.trim())
        }}
      >
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nombre o teléfono" />
        <button className="btn">Buscar</button>
      </form>
      <section className="tarjeta">
        <MensajeError error={lista.error} reintentar={lista.recargar} />
        {lista.cargando && !lista.data ? (
          <Cargando />
        ) : lista.data?.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Teléfono</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.data.map((c) => (
                  <tr key={c.id_cliente}>
                    <td>{c.nombre}</td>
                    <td>{c.telefono ?? '—'}</td>
                    <td className="derecha">
                      <button className="btn btn-sm" onClick={() => setEditando(c)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay clientes.</Vacio>
        )}
      </section>
      {editando && (
        <ClienteModal
          cliente={editando}
          onCerrar={(ok) => {
            setEditando(null)
            if (ok) lista.recargar()
          }}
        />
      )}
    </>
  )
}

export function ClienteModal({ cliente = {}, onCerrar }) {
  const notificar = useToast()
  const nuevo = !cliente.id_cliente
  const [form, setForm] = useState({ nombre: cliente.nombre ?? '', telefono: cliente.telefono ?? '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    e.stopPropagation()
    setEnviando(true)
    setError(null)
    try {
      const datos = { nombre: form.nombre, telefono: form.telefono || null }
      const r = nuevo ? await clientes.crear(datos) : await clientes.actualizar(cliente.id_cliente, datos)
      notificar(nuevo ? 'Cliente creado.' : 'Cliente actualizado.')
      onCerrar(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Nuevo cliente' : 'Editar cliente'} onCerrar={() => onCerrar(null)}>
      <form className="form" onSubmit={guardar}>
        <Campo etiqueta="Nombre">
          <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} maxLength={120} required />
        </Campo>
        <Campo etiqueta="Teléfono">
          <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} maxLength={20} />
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="acciones">
          <button type="button" className="btn" onClick={() => onCerrar(null)}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Selector de cliente con opción de crear uno nuevo en línea. */
export function SelectorCliente({ valor, onCambio }) {
  const lista = useCarga(() => clientes.listar({ limit: 200 }))
  const [crear, setCrear] = useState(false)
  return (
    <div className="input-con-boton">
      <select value={valor} onChange={(e) => onCambio(e.target.value)} required>
        <option value="">Seleccione un cliente</option>
        {(lista.data ?? []).map((c) => (
          <option key={c.id_cliente} value={c.id_cliente}>
            {c.nombre}
            {c.telefono ? ` · ${c.telefono}` : ''}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-sm" onClick={() => setCrear(true)}>
        + Nuevo
      </button>
      {crear && (
        <ClienteModal
          onCerrar={async (c) => {
            setCrear(false)
            if (c) {
              await lista.recargar()
              onCambio(String(c.id_cliente))
            }
          }}
        />
      )}
    </div>
  )
}
