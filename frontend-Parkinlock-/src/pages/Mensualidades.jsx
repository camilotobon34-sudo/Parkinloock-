import { useEffect, useState } from 'react'
import { mensualidades, vehiculos } from '../api/index.js'
import { TurnoRequerido } from '../components/Turno.jsx'
import { Aviso, Cabecera, Campo, Cargando, EstadoBadge, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, exportarCSV, fechaCorta, fechaISO, NOMBRE_TIPO, normalizarPlaca } from '../utils/format.js'
import { SelectorCliente } from './Clientes.jsx'

const FILTROS = [
  ['', 'Todas'],
  ['ACTIVA', 'Activas'],
  ['POR_VENCER', 'Por vencer'],
  ['VENCIDA', 'Vencidas'],
]

export default function Mensualidades() {
  const { esAdmin } = useAuth()
  const [estado, setEstado] = useState('')
  const [placa, setPlaca] = useState('')
  const [placaFiltro, setPlacaFiltro] = useState('')
  const datos = useCarga(() => mensualidades.listar({ estado, placa: placaFiltro }), [estado, placaFiltro])
  const [nueva, setNueva] = useState(false)
  const r = datos.data?.resumen
  const lista = datos.data?.mensualidades ?? []

  return (
    <>
      <Cabecera titulo="Mensualidades" subtitulo={esAdmin ? 'Planes de un mes desde la fecha de inicio' : 'Consulta de mensualidades (solo lectura)'}>
        <button
          className="btn"
          disabled={!lista.length}
          onClick={() =>
            exportarCSV('mensualidades', lista, [
              { titulo: 'Placa', valor: (m) => m.placa },
              { titulo: 'Plan', valor: (m) => m.plan },
              { titulo: 'Titular', valor: (m) => m.titular },
              { titulo: 'Inicio', valor: (m) => m.fecha_inicio },
              { titulo: 'Fin', valor: (m) => m.fecha_fin },
              { titulo: 'Valor', valor: (m) => m.valor },
              { titulo: 'Estado', valor: (m) => m.estado },
            ])
          }
        >
          Exportar CSV
        </button>
        {esAdmin && (
          <button className="btn btn-primario" onClick={() => setNueva(true)}>
            + Nueva mensualidad
          </button>
        )}
      </Cabecera>
      {r && (
        <p className="muted">
          {r.total} mensualidades · {r.activas} activas · {r.por_vencer} por vencer · {r.vencidas} vencidas
        </p>
      )}
      <div className="filtros">
        <div className="segmentado compacto">
          {FILTROS.map(([v, t]) => (
            <button key={v} type="button" className={estado === v ? 'activo' : ''} onClick={() => setEstado(v)}>
              {t}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setPlacaFiltro(normalizarPlaca(placa))
          }}
        >
          <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Placa" />
          <button className="btn">Filtrar</button>
        </form>
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
                  <th>Placa</th>
                  <th>Plan</th>
                  <th>Titular</th>
                  <th>Vigencia</th>
                  <th>Valor</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id_mensualidad}>
                    <td className="placa">{m.placa}</td>
                    <td>{m.plan}</td>
                    <td>{m.titular}</td>
                    <td>
                      {fechaCorta(m.fecha_inicio)} – {fechaCorta(m.fecha_fin)}
                    </td>
                    <td>{dinero(m.valor)}</td>
                    <td>
                      <EstadoBadge estado={m.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay mensualidades.</Vacio>
        )}
      </section>
      {nueva && (
        <NuevaMensualidad
          onCerrar={(ok) => {
            setNueva(false)
            if (ok) datos.recargar()
          }}
        />
      )}
    </>
  )
}

function NuevaMensualidad({ onCerrar }) {
  const notificar = useToast()
  const tipos = useCarga(() => vehiculos.tipos())
  const [form, setForm] = useState({ id_cliente: '', placa: '', tipo: 'CARRO', fecha_inicio: fechaISO(), efectivo_recibido: '' })
  const [fin, setFin] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!form.fecha_inicio) return setFin(null)
    mensualidades
      .calcularFin(form.fecha_inicio)
      .then((r) => setFin(r.fecha_fin))
      .catch(() => setFin(null))
  }, [form.fecha_inicio])

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const r = await mensualidades.crear({
        ...form,
        placa: normalizarPlaca(form.placa),
        id_cliente: Number(form.id_cliente),
        efectivo_recibido: Number(form.efectivo_recibido),
      })
      notificar(`Mensualidad de ${r.mensualidad.placa} creada hasta ${fechaCorta(r.mensualidad.fecha_fin)}. Cambio ${dinero(r.pago.cambio)}.`)
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Nueva mensualidad" onCerrar={() => onCerrar(false)}>
      <form className="form" onSubmit={guardar}>
        <TurnoRequerido>
          <Campo etiqueta="Cliente titular">
            <SelectorCliente valor={form.id_cliente} onCambio={(v) => setForm((f) => ({ ...f, id_cliente: v }))} />
          </Campo>
          <div className="fila-2">
            <Campo etiqueta="Placa">
              <input className="input-placa" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} required />
            </Campo>
            <Campo etiqueta="Tipo">
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {(tipos.data ?? []).map((t) => (
                  <option key={t.id_tipo_vehiculo} value={t.nombre}>
                    {NOMBRE_TIPO[t.nombre] ?? t.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          <div className="fila-2">
            <Campo etiqueta="Fecha de inicio">
              <input type="date" min={fechaISO()} value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Fecha de fin (calculada)">
              <input readOnly value={fin ? fechaCorta(fin) : ''} />
            </Campo>
          </div>
          <Campo etiqueta="Efectivo recibido" ayuda="Se cobra la tarifa Mensualidad vigente del tipo de vehículo.">
            <input type="number" min="0" step="100" value={form.efectivo_recibido} onChange={(e) => setForm({ ...form, efectivo_recibido: e.target.value })} required />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="acciones">
            <button type="button" className="btn" onClick={() => onCerrar(false)}>
              Cancelar
            </button>
            <button className="btn btn-primario" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Crear y cobrar'}
            </button>
          </div>
        </TurnoRequerido>
      </form>
    </Modal>
  )
}
