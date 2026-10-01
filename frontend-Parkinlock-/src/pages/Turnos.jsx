import { useState } from 'react'
import { turnos, usuarios } from '../api/index.js'
import { AbrirTurnoModal } from '../components/Turno.jsx'
import { Aviso, Cabecera, Cargando, EstadoBadge, MensajeError, Vacio } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { dinero, fechaHora } from '../utils/format.js'

export default function Turnos() {
  const { turno, esAdmin, refrescar } = useAuth()
  const notificar = useToast()
  const [abrir, setAbrir] = useState(null)
  const [cierre, setCierre] = useState(null)
  const lista = useCarga(() => (esAdmin ? turnos.listar() : Promise.resolve(null)), [esAdmin])
  const listaUsuarios = useCarga(() => (esAdmin ? usuarios.listar() : Promise.resolve([])), [esAdmin])
  const [usuarioTurno, setUsuarioTurno] = useState('')

  async function cerrar(id) {
    if (!window.confirm('¿Cerrar el turno?')) return
    try {
      const r = await turnos.cerrar(id)
      setCierre(r)
      notificar('Turno cerrado.')
      await refrescar()
      lista.recargar()
    } catch (err) {
      notificar(err.message, 'error')
    }
  }

  return (
    <>
      <Cabecera titulo="Turnos" subtitulo="Apertura y cierre de caja" />
      <section className="tarjeta">
        <h2>Mi turno</h2>
        {turno ? (
          <>
            <div className="datos-3">
              <div className="dato">
                <small>Caja</small>
                <strong>{turno.caja}</strong>
              </div>
              <div className="dato">
                <small>Horario programado</small>
                <strong className="texto-md">
                  {fechaHora(turno.inicio_programado)} – {fechaHora(turno.fin_programado)}
                </strong>
              </div>
              <div className="dato">
                <small>Caja inicial</small>
                <strong>{dinero(turno.caja_inicial)}</strong>
              </div>
            </div>
            <button className="btn" onClick={() => cerrar(turno.id_turno)}>
              Cerrar turno
            </button>
          </>
        ) : (
          <>
            <p className="muted">No tiene un turno abierto.</p>
            <button className="btn btn-primario" onClick={() => setAbrir({})}>
              Abrir turno
            </button>
          </>
        )}
        {cierre && (
          <Aviso tipo="ok">
            Turno #{cierre.id_turno} cerrado: {cierre.pagos} pagos, recaudado {dinero(cierre.recaudado)} (caja inicial {dinero(cierre.caja_inicial)}).
          </Aviso>
        )}
      </section>

      {esAdmin && (
        <section className="tarjeta">
          <div className="tarjeta-cab">
            <h2>Turnos del personal</h2>
            <div className="filtros sin-margen">
              <select value={usuarioTurno} onChange={(e) => setUsuarioTurno(e.target.value)}>
                <option value="">Abrir turno para…</option>
                {(listaUsuarios.data ?? [])
                  .filter((u) => u.estado === 'ACTIVO')
                  .map((u) => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre_completo}
                    </option>
                  ))}
              </select>
              <button className="btn btn-sm" disabled={!usuarioTurno} onClick={() => setAbrir({ idUsuario: Number(usuarioTurno) })}>
                Abrir
              </button>
            </div>
          </div>
          <MensajeError error={lista.error} reintentar={lista.recargar} />
          {lista.cargando && !lista.data ? (
            <Cargando />
          ) : lista.data?.length ? (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Usuario</th>
                    <th>Caja</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Base</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.data.map((t) => (
                    <tr key={t.id_turno}>
                      <td>{t.id_turno}</td>
                      <td>{t.usuario}</td>
                      <td>{t.caja}</td>
                      <td>{fechaHora(t.inicio_programado)}</td>
                      <td>{fechaHora(t.fin_programado)}</td>
                      <td>{dinero(t.caja_inicial)}</td>
                      <td>
                        <EstadoBadge estado={t.estado} />
                      </td>
                      <td>
                        {t.estado === 'ABIERTO' && (
                          <button className="btn btn-sm" onClick={() => cerrar(t.id_turno)}>
                            Cerrar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vacio>No hay turnos registrados.</Vacio>
          )}
        </section>
      )}
      {abrir && (
        <AbrirTurnoModal
          idUsuario={abrir.idUsuario}
          onCerrar={(ok) => {
            setAbrir(null)
            setUsuarioTurno('')
            if (ok) lista.recargar()
          }}
        />
      )}
    </>
  )
}
