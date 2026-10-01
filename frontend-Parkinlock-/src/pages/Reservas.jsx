import { useState } from 'react'
import { espacios, reservas, vehiculos } from '../api/index.js'
import { Aviso, Cabecera, Campo, Cargando, EstadoBadge, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { TurnoRequerido } from '../components/Turno.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, exportarCSV, fechaISO, horaCorta, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'
import { SelectorCliente } from './Clientes.jsx'

export default function Reservas() {
  const { esAdmin } = useAuth()
  const notificar = useToast()
  const [fecha, setFecha] = useState(fechaISO())
  const datos = useCarga(() => reservas.listar(fecha), [fecha])
  const [nueva, setNueva] = useState(false)
  const [confirmando, setConfirmando] = useState(null)

  async function cancelar(r) {
    if (!window.confirm(`¿Cancelar la reserva de ${r.placa}?`)) return
    try {
      await reservas.cancelar(r.id_reserva)
      notificar('Reserva cancelada.')
      datos.recargar()
    } catch (err) {
      notificar(err.message, 'error')
    }
  }

  const lista = datos.data?.reservas ?? []
  return (
    <>
      <Cabecera titulo="Reservas" subtitulo={esAdmin ? 'Crear, confirmar y cancelar reservas' : 'Crear y ver reservas'}>
        <button
          className="btn"
          disabled={!lista.length}
          onClick={() =>
            exportarCSV(`reservas_${fecha}`, lista, [
              { titulo: 'Placa', valor: (r) => r.placa },
              { titulo: 'Tipo', valor: (r) => r.tipo },
              { titulo: 'Cliente', valor: (r) => r.cliente },
              { titulo: 'Fecha', valor: (r) => r.fecha },
              { titulo: 'Inicio', valor: (r) => horaCorta(r.hora_inicio) },
              { titulo: 'Fin', valor: (r) => horaCorta(r.hora_fin) },
              { titulo: 'Espacio', valor: (r) => r.espacio ?? '' },
              { titulo: 'Estado', valor: (r) => r.estado },
              { titulo: 'Pagado', valor: (r) => r.valor_pagado ?? '' },
            ])
          }
        >
          Exportar CSV
        </button>
        <button className="btn btn-primario" onClick={() => setNueva(true)}>
          + Nueva reserva
        </button>
      </Cabecera>
      <div className="filtros">
        <label>
          Fecha <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {datos.data && (
          <span className="muted">
            {datos.data.resumen.programadas} programadas · {datos.data.resumen.sin_espacio} sin espacio asignado
          </span>
        )}
      </div>
      <section className="tarjeta">
        <MensajeError error={datos.error} reintentar={datos.recargar} />
        {datos.cargando && !datos.data ? (
          <Cargando />
        ) : lista.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Horario</th>
                  <th>Placa</th>
                  <th>Cliente</th>
                  <th>Espacio</th>
                  <th>Estado</th>
                  <th>Pago</th>
                  {esAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id_reserva}>
                    <td>
                      {horaCorta(r.hora_inicio)}–{horaCorta(r.hora_fin)}
                    </td>
                    <td className="placa">
                      {r.placa} <small className="muted">{NOMBRE_TIPO[r.tipo]}</small>
                    </td>
                    <td>{r.cliente}</td>
                    <td>{r.espacio ?? 'Sin asignar'}</td>
                    <td>
                      <EstadoBadge estado={r.estado} />
                    </td>
                    <td>{r.valor_pagado !== null ? dinero(r.valor_pagado) : '—'}</td>
                    {esAdmin && (
                      <td className="derecha nowrap">
                        {r.estado === 'PENDIENTE' && (
                          <>
                            <button className="btn btn-sm btn-verde" onClick={() => setConfirmando(r)}>
                              Confirmar
                            </button>{' '}
                            <button className="btn btn-sm" onClick={() => cancelar(r)}>
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay reservas para esta fecha.</Vacio>
        )}
      </section>
      {nueva && (
        <NuevaReserva
          fechaInicial={fecha}
          onCerrar={(r) => {
            setNueva(false)
            if (r) {
              if (r.fecha !== fecha) setFecha(r.fecha)
              else datos.recargar()
            }
          }}
        />
      )}
      {confirmando && (
        <ConfirmarReserva
          reserva={confirmando}
          onCerrar={(ok) => {
            setConfirmando(null)
            if (ok) datos.recargar()
          }}
        />
      )}
    </>
  )
}

function NuevaReserva({ fechaInicial, onCerrar }) {
  const notificar = useToast()
  const tipos = useCarga(() => vehiculos.tipos())
  const mapa = useCarga(() => espacios.mapa())
  const [form, setForm] = useState({ id_cliente: '', placa: '', tipo: 'CARRO', fecha: fechaInicial, hora_inicio: '', hora_fin: '', id_espacio: '' })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const r = await reservas.crear({
        ...form,
        placa: normalizarPlaca(form.placa),
        id_cliente: Number(form.id_cliente),
        id_espacio: form.id_espacio ? Number(form.id_espacio) : undefined,
      })
      notificar(`Reserva de ${r.placa} creada (pendiente de confirmación).`)
      onCerrar(r)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const espaciosTipo = (mapa.data?.espacios ?? []).filter((e) => e.tipo === form.tipo)
  return (
    <Modal titulo="Nueva reserva" onCerrar={() => onCerrar(null)}>
      <form className="form" onSubmit={guardar}>
        <Campo etiqueta="Cliente">
          <SelectorCliente valor={form.id_cliente} onCambio={(v) => setForm((f) => ({ ...f, id_cliente: v }))} />
        </Campo>
        <div className="fila-2">
          <Campo etiqueta="Placa">
            <input className="input-placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} required />
          </Campo>
          <Campo etiqueta="Tipo">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, id_espacio: '' })}>
              {(tipos.data ?? []).map((t) => (
                <option key={t.id_tipo_vehiculo} value={t.nombre}>
                  {NOMBRE_TIPO[t.nombre] ?? t.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <div className="fila-3">
          <Campo etiqueta="Fecha">
            <input type="date" value={form.fecha} min={fechaISO()} onChange={cambiar('fecha')} required />
          </Campo>
          <Campo etiqueta="Hora inicio">
            <input type="time" value={form.hora_inicio} onChange={cambiar('hora_inicio')} required />
          </Campo>
          <Campo etiqueta="Hora fin">
            <input type="time" value={form.hora_fin} onChange={cambiar('hora_fin')} required />
          </Campo>
        </div>
        <Campo etiqueta="Espacio (opcional)">
          <select value={form.id_espacio} onChange={cambiar('id_espacio')}>
            <option value="">Sin asignar</option>
            {espaciosTipo.map((e) => (
              <option key={e.id_espacio} value={e.id_espacio}>
                {e.codigo}
              </option>
            ))}
          </select>
        </Campo>
        <p className="muted">La tarifa Reserva se cobra al confirmar la reserva.</p>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="acciones">
          <button type="button" className="btn" onClick={() => onCerrar(null)}>
            Cancelar
          </button>
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Guardando…' : 'Crear reserva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ConfirmarReserva({ reserva, onCerrar }) {
  const notificar = useToast()
  const [efectivo, setEfectivo] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function confirmar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const r = await reservas.confirmar(reserva.id_reserva, Number(efectivo))
      notificar(`Reserva confirmada. Cobrado ${dinero(r.pago.valor)}, cambio ${dinero(r.pago.cambio)}.`)
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={`Confirmar reserva · ${reserva.placa}`} onCerrar={() => onCerrar(false)}>
      <form className="form" onSubmit={confirmar}>
        <TurnoRequerido>
          <p>
            Se cobrará la tarifa <strong>Reserva</strong> vigente para {NOMBRE_TIPO[reserva.tipo]?.toLowerCase()}. El valor lo calcula el sistema al confirmar.
          </p>
          <Campo etiqueta="Efectivo recibido">
            <input type="number" min="0" step="100" value={efectivo} onChange={(e) => setEfectivo(e.target.value)} required autoFocus />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="acciones">
            <button type="button" className="btn" onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button className="btn btn-verde" disabled={enviando}>
              {enviando ? 'Confirmando…' : 'Confirmar y cobrar'}
            </button>
          </div>
        </TurnoRequerido>
      </form>
    </Modal>
  )
}
