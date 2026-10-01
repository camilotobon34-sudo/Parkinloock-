import { useState } from 'react'
import { usuarios } from '../api/index.js'
import { Aviso, Cabecera, Campo, Cargando, EstadoBadge, MensajeError, Modal, Vacio } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useCarga } from '../hooks/useCarga.js'
import { NOMBRE_ROL } from '../utils/format.js'

export default function Usuarios() {
  const { usuario: yo } = useAuth()
  const notificar = useToast()
  const lista = useCarga(() => usuarios.listar())
  const [editando, setEditando] = useState(null)

  async function alternarEstado(u) {
    const estado = u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    try {
      await usuarios.cambiarEstado(u.id_usuario, estado)
      notificar(`${u.nombre_completo}: ${estado.toLowerCase()}.`)
      lista.recargar()
    } catch (err) {
      notificar(err.message, 'error')
    }
  }

  return (
    <>
      <Cabecera titulo="Usuarios" subtitulo="Administradores y trabajadores (solo Administrador)">
        <button className="btn btn-primario" onClick={() => setEditando({})}>
          + Nuevo usuario
        </button>
      </Cabecera>
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
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lista.data.map((u) => (
                  <tr key={u.id_usuario}>
                    <td>{u.nombre_completo}</td>
                    <td>{u.usuario}</td>
                    <td>{u.correo ?? '—'}</td>
                    <td>{NOMBRE_ROL[u.rol]}</td>
                    <td>
                      <EstadoBadge estado={u.estado} />
                    </td>
                    <td className="derecha nowrap">
                      <button className="btn btn-sm" onClick={() => setEditando(u)}>
                        Editar
                      </button>{' '}
                      {u.id_usuario !== yo.id_usuario && (
                        <button className="btn btn-sm" onClick={() => alternarEstado(u)}>
                          {u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Vacio>No hay usuarios.</Vacio>
        )}
      </section>
      {editando && (
        <UsuarioModal
          usuario={editando}
          esPropio={editando.id_usuario === yo.id_usuario}
          onCerrar={(ok) => {
            setEditando(null)
            if (ok) lista.recargar()
          }}
        />
      )}
    </>
  )
}

function UsuarioModal({ usuario, esPropio, onCerrar }) {
  const notificar = useToast()
  const nuevo = !usuario.id_usuario
  const [form, setForm] = useState({
    nombre_completo: usuario.nombre_completo ?? '',
    usuario: usuario.usuario ?? '',
    correo: usuario.correo ?? '',
    rol: usuario.rol ?? 'TRABAJADOR',
    contrasena: '',
  })
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function guardar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (nuevo) {
        await usuarios.crear({ ...form, correo: form.correo || null })
      } else {
        const datos = { nombre_completo: form.nombre_completo, correo: form.correo || null, rol: form.rol }
        if (form.contrasena) datos.contrasena = form.contrasena
        await usuarios.actualizar(usuario.id_usuario, datos)
      }
      notificar(nuevo ? 'Usuario creado.' : 'Usuario actualizado.')
      onCerrar(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={nuevo ? 'Nuevo usuario' : `Editar ${usuario.usuario}`} onCerrar={() => onCerrar(false)}>
      <form className="form" onSubmit={guardar}>
        <Campo etiqueta="Nombre completo">
          <input value={form.nombre_completo} onChange={cambiar('nombre_completo')} maxLength={120} required />
        </Campo>
        <div className="fila-2">
          <Campo etiqueta="Usuario">
            <input value={form.usuario} onChange={cambiar('usuario')} maxLength={50} required disabled={!nuevo} pattern="[A-Za-z0-9._\-]+" />
          </Campo>
          <Campo etiqueta="Correo (opcional)">
            <input type="email" value={form.correo} onChange={cambiar('correo')} maxLength={120} />
          </Campo>
        </div>
        <Campo etiqueta="Rol">
          <select value={form.rol} onChange={cambiar('rol')} disabled={esPropio}>
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="TRABAJADOR">Trabajador</option>
          </select>
        </Campo>
        <Campo etiqueta={nuevo ? 'Contraseña' : 'Nueva contraseña (opcional)'} ayuda="Mínimo 8 caracteres.">
          <input type="password" value={form.contrasena} onChange={cambiar('contrasena')} minLength={8} maxLength={72} required={nuevo} autoComplete="new-password" />
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
