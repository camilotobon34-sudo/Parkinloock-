import { useState } from 'react'
import { Aviso } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login, registrarCliente, aviso } = useAuth()
  const [rol, setRol] = useState('ADMINISTRADOR')
  const [modoCliente, setModoCliente] = useState('entrar')
  const [usuario, setUsuario] = useState('')
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [ver, setVer] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      sessionStorage.setItem('parkinlock_destino', rol === 'CLIENTE' ? '/cliente' : '/')
      if (rol === 'CLIENTE' && modoCliente === 'registrar') {
        await registrarCliente({
          usuario: usuario.trim(),
          nombre: nombre.trim(),
          correo: correo.trim(),
          contrasena,
          recordar,
        })
      } else {
        await login({ usuario: usuario.trim(), contrasena, rol, recordar })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const esCliente = rol === 'CLIENTE'
  const registrando = esCliente && modoCliente === 'registrar'

  return (
    <div className="login">
      <div className="login-marca">
        <img src="/logo-web.png" alt="Parqueadero Systems & Programación" className="login-logo" />
        <h2>PARKINLOCK</h2>
        <p>Control de entradas, salidas, cobros, reservas y mensualidades.</p>
      </div>
      <div className="login-tarjeta">
        <img src="/logo-web.png" alt="" className="login-logo-movil" />
        <h1>{registrando ? 'Registro de cliente' : 'Iniciar sesión'}</h1>
        <p className="sub">
          {registrando
            ? 'Crea tu cuenta con usuario, nombre, correo y contraseña.'
            : 'Elige Admin, Trabajador o Cliente.'}
        </p>
        <div className="segmentado roles-login">
          {[
            ['ADMINISTRADOR', 'Admin'],
            ['TRABAJADOR', 'Trabajador'],
            ['CLIENTE', 'Cliente'],
          ].map(([valor, texto]) => (
            <button
              type="button"
              key={valor}
              className={rol === valor ? 'activo' : ''}
              onClick={() => {
                setRol(valor)
                setError(null)
              }}
            >
              {texto}
            </button>
          ))}
        </div>
        {esCliente && (
          <div className="segmentado compacto">
            <button type="button" className={modoCliente === 'entrar' ? 'activo' : ''} onClick={() => setModoCliente('entrar')}>
              Entrar
            </button>
            <button type="button" className={modoCliente === 'registrar' ? 'activo' : ''} onClick={() => setModoCliente('registrar')}>
              Registrarse
            </button>
          </div>
        )}
        <form className="form" onSubmit={enviar}>
          <label className="campo">
            <span className="campo-etiqueta">{registrando ? 'Usuario' : 'Correo o usuario'}</span>
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
          </label>
          {registrando && (
            <>
              <label className="campo">
                <span className="campo-etiqueta">Nombre completo</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
              </label>
              <label className="campo">
                <span className="campo-etiqueta">Correo</span>
                <input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" required />
              </label>
            </>
          )}
          <label className="campo">
            <span className="campo-etiqueta">Contraseña</span>
            <div className="input-con-boton">
              <input
                type={ver ? 'text' : 'password'}
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                autoComplete={registrando ? 'new-password' : 'current-password'}
                minLength={registrando ? 8 : undefined}
                required
              />
              <button type="button" className="btn-icono" onClick={() => setVer(!ver)} aria-label="Mostrar contraseña">
                {ver ? '🙈' : '👁'}
              </button>
            </div>
          </label>
          <label className="check">
            <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} /> Recordar acceso
          </label>
          {(error || aviso) && <Aviso tipo="error">{error || aviso}</Aviso>}
          <button className="btn btn-primario btn-bloque btn-grande" disabled={enviando}>
            {enviando ? (registrando ? 'Registrando…' : 'Ingresando…') : registrando ? '→ Crear cuenta' : '→ Entrar'}
          </button>
          <p className="ayuda-login">
            {esCliente
              ? 'Si aún no tienes cuenta, elige Registrarse. Luego podrás Entrar con tu usuario y contraseña.'
              : '¿Necesitas ayuda? Contacta al administrador de la sede.'}
          </p>
        </form>
      </div>
    </div>
  )
}
