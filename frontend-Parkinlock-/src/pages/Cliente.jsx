import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getToken, setKioscoToken } from '../api/index.js'
import { Autoservicio } from '../components/Autoservicio.jsx'
import { useAuth } from '../context/AuthContext.jsx'

/** Pantalla completa de autoservicio. Al abrirla, el trabajador deja activado el modo cliente en este equipo. */
export default function Cliente() {
  const { turno } = useAuth()
  const [activado] = useState(() => (turno ? setKioscoToken(getToken()) ?? true : false))

  if (!activado) {
    return (
      <div className="kiosco">
        <div className="kiosco-tarjeta">
          <h1>Modo cliente no disponible</h1>
          <p className="sub">Abra un turno antes de activar el autoservicio.</p>
          <Link className="btn btn-primario btn-grande" to="/turnos">
            Ir a Turnos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="kiosco">
      <header className="kiosco-cab">
        <img src="/logo-web.png" alt="Parqueadero Systems & Programación" className="kiosco-logo" />
        <Link to="/" className="kiosco-salir" onClick={(e) => !window.confirm('¿Salir del modo cliente?') && e.preventDefault()}>
          Salir del modo cliente
        </Link>
      </header>
      <div className="kiosco-tarjeta">
        <h1>Bienvenido</h1>
        <p className="sub">Escriba su placa, elija carro o moto y reciba su recibo.</p>
        <Autoservicio />
      </div>
    </div>
  )
}
