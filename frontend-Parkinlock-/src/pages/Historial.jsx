import { useState } from 'react'
import { movimientos, pagos } from '../api/index.js'
import { Cabecera, Cargando, EstadoBadge, MensajeError, Vacio } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, duracion, exportarCSV, fechaHora, fechaISO, hora, NOMBRE_TIPO, normalizarPlaca, sumarDias } from '../utils/format.js'

function rangoUltimosDias(dias) {
  return { fecha: '', desde: sumarDias(-(dias - 1)), hasta: fechaISO() }
}

export default function Historial() {
  const { esAdmin } = useAuth()
  const [vista, setVista] = useState('movimientos')
  const [placa, setPlaca] = useState('')
  const [filtros, setFiltros] = useState(() => ({ placa: '', ...rangoUltimosDias(7) }))
  const [rapido, setRapido] = useState('7d')
  const datos = useCarga(
    () =>
      vista === 'pagos'
        ? pagos.listar({ fecha: filtros.fecha, desde: filtros.desde, hasta: filtros.hasta, limit: 200 })
        : movimientos.historial({ ...filtros, limit: 200 }),
    [vista, filtros],
  )
  const lista = datos.data ?? []

  function aplicarRapido(clave) {
    setRapido(clave)
    setPlaca('')
    if (clave === 'hoy') setFiltros({ placa: '', fecha: fechaISO(), desde: '', hasta: '' })
    else if (clave === 'ayer') setFiltros({ placa: '', fecha: sumarDias(-1), desde: '', hasta: '' })
    else if (clave === '7d') setFiltros({ placa: '', ...rangoUltimosDias(7) })
    else setFiltros({ placa: '', fecha: '', desde: '', hasta: '' })
  }

  function exportar() {
    if (vista === 'pagos') {
      return exportarCSV('pagos', lista, [
        { titulo: 'Pago', valor: (p) => p.id_pago },
        { titulo: 'Fecha', valor: (p) => fechaHora(p.fecha_hora) },
        { titulo: 'Concepto', valor: (p) => p.concepto },
        { titulo: 'Trabajador', valor: (p) => p.trabajador },
        { titulo: 'Valor', valor: (p) => p.valor },
        { titulo: 'Efectivo', valor: (p) => p.efectivo_recibido },
        { titulo: 'Cambio', valor: (p) => p.cambio },
      ])
    }
    exportarCSV('historial', lista, [
      { titulo: 'Placa', valor: (m) => m.placa },
      { titulo: 'Tipo', valor: (m) => m.tipo },
      { titulo: 'Entrada', valor: (m) => fechaHora(m.fecha_hora_entrada) },
      { titulo: 'Salida', valor: (m) => fechaHora(m.fecha_hora_salida) },
      { titulo: 'Minutos', valor: (m) => m.minutos ?? '' },
      { titulo: 'Valor', valor: (m) => m.valor_total ?? '' },
      { titulo: 'Pagado', valor: (m) => m.valor_pagado ?? '' },
      { titulo: 'Estado', valor: (m) => m.estado },
      { titulo: 'Trabajador entrada', valor: (m) => m.trabajador_entrada },
      { titulo: 'Trabajador salida', valor: (m) => m.trabajador_salida ?? '' },
    ])
  }

  return (
    <>
      <Cabecera titulo="Historial" subtitulo={esAdmin ? 'Movimientos y pagos de todos los turnos' : 'Movimientos de sus turnos'}>
        <button className="btn" onClick={exportar} disabled={!lista.length}>
          Exportar CSV
        </button>
      </Cabecera>
      <div className="filtros">
        {esAdmin && (
          <div className="segmentado compacto">
            <button className={vista === 'movimientos' ? 'activo' : ''} onClick={() => setVista('movimientos')}>
              Movimientos
            </button>
            <button className={vista === 'pagos' ? 'activo' : ''} onClick={() => setVista('pagos')}>
              Pagos
            </button>
          </div>
        )}
        <div className="segmentado compacto">
          <button type="button" className={rapido === 'hoy' ? 'activo' : ''} onClick={() => aplicarRapido('hoy')}>
            Hoy
          </button>
          <button type="button" className={rapido === 'ayer' ? 'activo' : ''} onClick={() => aplicarRapido('ayer')}>
            Ayer
          </button>
          <button type="button" className={rapido === '7d' ? 'activo' : ''} onClick={() => aplicarRapido('7d')}>
            Últimos 7 días
          </button>
          <button type="button" className={rapido === 'todo' ? 'activo' : ''} onClick={() => aplicarRapido('todo')}>
            Todo
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setRapido('custom')
            setFiltros({
              placa: normalizarPlaca(placa),
              fecha: '',
              desde: filtros.desde,
              hasta: filtros.hasta,
            })
          }}
        >
          {vista === 'movimientos' && <input value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} placeholder="Placa" />}
          <label>
            Desde{' '}
            <input
              type="date"
              value={filtros.desde || filtros.fecha || ''}
              onChange={(e) => {
                setRapido('custom')
                setFiltros({ ...filtros, fecha: '', desde: e.target.value, hasta: filtros.hasta || fechaISO() })
              }}
            />
          </label>
          <label>
            Hasta{' '}
            <input
              type="date"
              value={filtros.hasta || filtros.fecha || ''}
              onChange={(e) => {
                setRapido('custom')
                setFiltros({ ...filtros, fecha: '', hasta: e.target.value, desde: filtros.desde || e.target.value })
              }}
            />
          </label>
          <button className="btn">Filtrar</button>
          <button type="button" className="btn" onClick={() => aplicarRapido('7d')}>
            Limpiar
          </button>
        </form>
      </div>
      <section className="tarjeta">
        <MensajeError error={datos.error} reintentar={datos.recargar} />
        {datos.cargando && !datos.data ? (
          <Cargando />
        ) : !lista.length ? (
          <Vacio>Sin resultados para el rango seleccionado.</Vacio>
        ) : vista === 'pagos' && lista[0]?.id_pago !== undefined ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Trabajador</th>
                  <th>Valor</th>
                  <th>Efectivo</th>
                  <th>Cambio</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id_pago}>
                    <td>{p.id_pago}</td>
                    <td>{fechaHora(p.fecha_hora)}</td>
                    <td>{p.concepto}</td>
                    <td>{p.trabajador}</td>
                    <td>{dinero(p.valor)}</td>
                    <td>{dinero(p.efectivo_recibido)}</td>
                    <td>{dinero(p.cambio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : vista === 'pagos' || lista[0]?.id_movimiento === undefined ? (
          <Cargando />
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Tiempo</th>
                  <th>Valor</th>
                  <th>Estado</th>
                  <th>Trabajador</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id_movimiento}>
                    <td className="placa">
                      {m.placa} <small className="muted">{NOMBRE_TIPO[m.tipo]}</small>
                    </td>
                    <td>{m.fecha}</td>
                    <td>{hora(m.fecha_hora_entrada)}</td>
                    <td>{hora(m.fecha_hora_salida)}</td>
                    <td>{duracion(m.minutos)}</td>
                    <td>{m.valor_total !== null ? dinero(m.valor_total) : '—'}</td>
                    <td>
                      <EstadoBadge estado={m.estado} />
                    </td>
                    <td>{m.trabajador_salida ?? m.trabajador_entrada}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
