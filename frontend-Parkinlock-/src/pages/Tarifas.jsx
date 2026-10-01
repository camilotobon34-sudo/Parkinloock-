import { useEffect, useState } from 'react'
import { tarifas } from '../api/index.js'
import { Aviso, Cabecera, Campo, Cargando, MensajeError, Vacio } from '../components/ui.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, fechaCorta, fechaISO, NOMBRE_CONCEPTO, NOMBRE_TIPO } from '../utils/format.js'

const CONCEPTOS = ['HORA', 'FRACCION', 'NOCHE', 'DIA', 'RESERVA', 'MENSUALIDAD']

export default function Tarifas() {
  const notificar = useToast()
  const vigentes = useCarga(() => tarifas.vigentes())
  const historial = useCarga(() => tarifas.historial())
  const [valores, setValores] = useState({})
  const [desde, setDesde] = useState(fechaISO())
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (vigentes.data) setValores(structuredClone(vigentes.data.tarifas))
  }, [vigentes.data])

  const tipos = Object.keys(vigentes.data?.tarifas ?? {})

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    const cambios = []
    for (const tipo of tipos) {
      for (const c of CONCEPTOS) {
        const nuevo = Number(valores[tipo]?.[c])
        if (nuevo !== vigentes.data.tarifas[tipo]?.[c]) cambios.push({ tipo, concepto: c, valor: nuevo })
      }
    }
    if (!cambios.length) return setError('No hay cambios para guardar.')
    setEnviando(true)
    try {
      const r = await tarifas.configurar({ vigente_desde: desde, tarifas: cambios })
      notificar(`${r.actualizadas} tarifas guardadas, vigentes desde ${fechaCorta(r.vigente_desde)}.`)
      vigentes.recargar()
      historial.recargar()
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Cabecera titulo="Tarifas" subtitulo="Configuración de tarifas (solo Administrador)" />
      <MensajeError error={vigentes.error} reintentar={vigentes.recargar} />
      {!vigentes.data ? (
        <Cargando />
      ) : (
        <form className="tarjeta form" onSubmit={guardar}>
          <h2>Tarifas vigentes hoy</h2>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  {tipos.map((t) => (
                    <th key={t}>{NOMBRE_TIPO[t] ?? t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONCEPTOS.map((c) => (
                  <tr key={c}>
                    <td>{NOMBRE_CONCEPTO[c]}</td>
                    {tipos.map((t) => (
                      <td key={t}>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={valores[t]?.[c] ?? ''}
                          onChange={(e) => setValores({ ...valores, [t]: { ...valores[t], [c]: e.target.value } })}
                          required
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Campo etiqueta="Vigente desde" ayuda="Los cambios aplican desde la fecha indicada (hoy o futura); el historial se conserva.">
            <input type="date" min={fechaISO()} value={desde} onChange={(e) => setDesde(e.target.value)} required />
          </Campo>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <div className="acciones">
            <button className="btn btn-primario" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
      <section className="tarjeta">
        <h2>Historial de tarifas</h2>
        {historial.data?.length ? (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Vigente desde</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {historial.data.map((t) => (
                  <tr key={t.id_tarifa}>
                    <td>{fechaCorta(t.vigente_desde)}</td>
                    <td>{NOMBRE_TIPO[t.tipo] ?? t.tipo}</td>
                    <td>{NOMBRE_CONCEPTO[t.concepto]}</td>
                    <td>{dinero(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>Sin historial.</Vacio>
        )}
      </section>
    </>
  )
}
