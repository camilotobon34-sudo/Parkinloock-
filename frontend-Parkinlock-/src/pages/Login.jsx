import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Aviso } from '../components/ui.jsx'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login, aviso } = useAuth()
  const location = useLocation()
  const [rol, setRol] = useState('ADMINISTRADOR')
  const [usuario, setUsuario] = useState('')
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
      const esCliente = rol === 'CLIENTE'
      sessionStorage.setItem('parkinlock_destino', esCliente ? '/cliente' : (location.state?.desde ?? '/'))
      await login({ usuario: usuario.trim(), contrasena, rol: esCliente ? undefined : rol, recordar })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <span className="marca-logo grande">P</span>
        <h2>PARKINLOCK</h2>
        <p>Control de entradas, salidas, cobros, reservas y mensualidades.</p>
      </div>
      <form className="login-tarjeta" onSubmit={enviar}>
        <h1>Iniciar sesión</h1>
        <p className="sub">Selecciona tu rol e ingresa tus credenciales.</p>
        <div className="segmentado">
          {[
            ['ADMINISTRADOR', '🛡 Administrador'],
            ['TRABAJADOR', '👤 Trabajador'],
            ['CLIENTE', '🎫 Cliente'],
          ].map(([valor, texto]) => (
            <button type="button" key={valor} className={rol === valor ? 'activo' : ''} onClick={() => setRol(valor)}>
              {texto}
            </button>
          ))}
        </div>
        {rol === 'CLIENTE' && (
          <Aviso tipo="info">
            Autoservicio para clientes: un trabajador o administrador ingresa sus credenciales para activar la pantalla donde el cliente escribe su placa, elige
            carro o moto y recibe su recibo de entrada.
          </Aviso>
        )}
        <label className="campo">
          <span className="campo-etiqueta">Correo o usuario</span>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="campo">
          <span className="campo-etiqueta">Contraseña</span>
          <div className="input-con-boton">
            <input
              type={ver ? 'text' : 'password'}
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete="current-password"
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
          {enviando ? 'Ingresando…' : '→ Entrar al sistema'}
        </button>
        <p className="ayuda-login">¿Necesitas ayuda? Contacta al administrador de la sede.</p>
      </form>
    </div>
  )
}
