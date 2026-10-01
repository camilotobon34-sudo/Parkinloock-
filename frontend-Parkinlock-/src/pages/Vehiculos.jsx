import { useState } from 'react'
import { Link } from 'react-router-dom'
import { clientes, vehiculos } from '../api/index.js'
import { Aviso, Badge, Cabecera, Campo, Cargando, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { fechaCorta, hora, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'

export default function Vehiculos() {
  const [filtro, setFiltro] = useState('')
  const [placaBuscada, setPlacaBuscada] = useState('')
  const lista = useCarga(() => vehiculos.listar({ placa: placaBuscada, limit: 200 }), [placaBuscada])
  const [detalle, setDetalle] = useState(null)
  const [errorDetalle, setErrorDetalle] = useState(null)
  const [editando, setEditando] = useState(null)

  async function buscar(e) {
    e?.preventDefault()
    const p = normalizarPlaca(filtro)
    setFiltro(p)
    setPlacaBuscada(p)
    setDetalle(null)
    setErrorDetalle(null)
    if (!p) return
    try {
      setDetalle(await vehiculos.buscarPorPlaca(p))
    } catch (err) {
      setErrorDetalle(err.status === 404 ? `No hay un vehículo registrado con la placa ${p}.` : err.message)
    }
  }

  return (
    <>
      <Cabecera titulo="Vehículos" subtitulo="Búsqueda por placa, registro y actualización">
        <button className="btn btn-primario" onClick={() => setEditando({})}>
          + Registrar vehículo
        </button>
      </Cabecera>
      <form className="buscador" onSubmit={buscar}>
        <label>Buscar vehículo por placa</label>
        <div className="buscador-fila">
          <input className="input-placa" value={filtro} onChange={(e) => setFiltro(e.target.value.toUpperCase())} placeholder="ABC123" />
          <button className="btn btn-primario">Buscar</button>
        </div>
      </form>
      {errorDetalle && <Aviso tipo="info">{errorDetalle}</Aviso>}
      {detalle && (
        <section className="tarjeta">
          <div className="vehiculo-cab">
            <span className="vehiculo-icono">{detalle.tipo === 'MOTO' ? '🏍' : '🚗'}</span>
            <div>
              <h2 className="placa">{detalle.placa}</h2>
              <small className="muted">
                {NOMBRE_TIPO[detalle.tipo]} · {detalle.cliente ?? 'Sin cliente asociado'}
              </small>
            </div>
            {detalle.en_parqueadero ? <Badge tono="rojo">EN OPERACIÓN · {detalle.movimiento_abierto.espacio}</Badge> : <Badge tono="verde">FUERA</Badge>}
          </div>
          {detalle.en_parqueadero && (
            <p>
              Entrada a las {hora(detalle.movimiento_abierto.fecha_hora_entrada)} ({fechaCorta(detalle.movimiento_abierto.fecha_hora_entrada)}).{' '}
              <Link to={`/salida?placa=${detalle.placa}`}>Cobrar salida</Link>
            </p>
          )}
          {detalle.mensualidad_vigente && (
            <p>
              Mensualidad vigente del {fechaCorta(detalle.mensualidad_vigente.fecha_inicio)} al {fechaCorta(detalle.mensualidad_vigente.fecha_fin)}.
            </p>
          )}
          <button className="btn btn-sm" onClick={() => setEditando(detalle)}>
            Editar
          </button>
        </section>
      )}
      <section className="tarjeta">
        <MensajeError error={lista.error} reintentar={lista.recargar} />
        {lista.cargando && !lista.data ? (
          <Cargando />
        ) : lista.data?.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.data.map((v) => (
                  <tr key={v.id_vehiculo}>
                    <td className="placa">{v.placa}</td>
                    <td>{NOMBRE_TIPO[v.tipo]}</td>
                    <td>{v.cliente ?? '—'}</td>
                    <td className="derecha">
                      <button className="btn btn-sm" onClick={() => setEditando(v)}>
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay vehículos registrados.</Vacio>
        )}
      </section>
      {editando && (
        <VehiculoModal
          vehiculo={editando}
          onCerrar={(guardado) => {
            setEditando(null)
            if (guardado) {
              lista.recargar()
              if (detalle) setDetalle(null)
            }
          }}
        />
      )}
    </>
  )
}

function VehiculoModal({ vehiculo, onCerrar }) {
  const notificar = useToast()
  const tipos = useCarga(() => vehiculos.tipos())
  const listaClientes = useCarga(() => clientes.listar({ limit: 200 }))
  const nuevo = !vehiculo.id_vehiculo
  const [form, setForm] = useState({ placa: vehiculo.placa ?? '', tipo: vehiculo.tipo ?? 'CARRO', id_cliente: vehiculo.id_cliente ?? '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const datos = { placa: normalizarPlaca(form.placa), tipo: form.tipo, id_cliente: form.id_cliente ? Number(form.id_cliente) : null }
    try {
      if (nuevo) await vehiculos.registrar({ ...datos, id_cliente: datos.id_cliente ?? undefined })
      else await vehiculos.actualizar(vehiculo.id_vehiculo, datos)
      notificar(nuevo ? `Vehículo ${datos.placa} registrado.` : `Vehículo ${datos.placa} actualizado.`)
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Registrar vehículo' : `Editar ${vehiculo.placa}`} onCerrar={() => onCerrar(false)}>
      <form className="form" onSubmit={guardar}>
        <Campo etiqueta="Placa">
          <input className="input-placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} required />
        </Campo>
        <Campo etiqueta="Tipo de vehículo">
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            {(tipos.data ?? []).map((t) => (
              <option key={t.id_tipo_vehiculo} value={t.nombre}>
                {NOMBRE_TIPO[t.nombre] ?? t.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Cliente (opcional)">
          <select value={form.id_cliente} onChange={(e) => setForm({ ...form, id_cliente: e.target.value })}>
            <option value="">Sin cliente</option>
            {(listaClientes.data ?? []).map((c) => (
              <option key={c.id_cliente} value={c.id_cliente}>
                {c.nombre}
                {c.telefono ? ` · ${c.telefono}` : ''}
              </option>
            ))}
          </select>
        </Campo>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="acciones">
          <button type="button" className="btn" onClick={() => onCerrar(false)}>
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
