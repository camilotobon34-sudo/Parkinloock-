import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { NOMBRE_ROL } from '../utils/format.js'
import { TurnoResumen } from './Turno.jsx'

const NAVEGACION = [
  { ruta: '/', texto: 'Panel', icono: '▦' },
  { ruta: '/cliente', texto: 'Modo cliente', icono: '🎫' },
  { ruta: '/entrada', texto: 'Registrar entrada', icono: '→' },
  { ruta: '/salida', texto: 'Cobrar salida', icono: '$' },
  { ruta: '/vehiculos', texto: 'Vehículos', icono: '🚗' },
  { ruta: '/reservas', texto: 'Reservas', icono: '📅' },
  { ruta: '/mensualidades', texto: 'Mensualidades', icono: '🗓' },
  { ruta: '/clientes', texto: 'Clientes', icono: '👤' },
  { ruta: '/historial', texto: 'Historial', icono: '☰' },
  { ruta: '/alertas', texto: 'Alertas', icono: '!' },
  { ruta: '/turnos', texto: 'Turnos', icono: '⏱' },
  { ruta: '/tarifas', texto: 'Tarifas', icono: '%', admin: true },
  { ruta: '/usuarios', texto: 'Usuarios', icono: '⚙', admin: true },
]

function Reloj() {
  const [ahora, setAhora] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  const hh = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const dd = ahora.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  return <span className="reloj">{`${hh} · ${dd}`}</span>
}

export function Layout() {
  const { usuario, esAdmin, turno, logout } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()
  useEffect(() => setAbierto(false), [location.pathname])

  return (
    <div className={`app ${abierto ? 'menu-abierto' : ''}`}>
      <aside className="sidebar">
        <div className="marca">
          <img src="/logo-icono.png" alt="" className="marca-img" />
          <div>
            <strong>PARKINLOCK</strong>
            <small>Systems &amp; Programación</small>
          </div>
        </div>
        <nav>
          {NAVEGACION.filter((n) => !n.admin || esAdmin).map((n) => (
            <NavLink key={n.ruta} to={n.ruta} end={n.ruta === '/'} className="nav-item">
              <span className="nav-icono">{n.icono}</span>
              {n.texto}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-pie">
          <div className="usuario-chip">
            <span className="avatar">{usuario?.nombre_completo?.[0] ?? '?'}</span>
            <div>
              <strong>{usuario?.nombre_completo}</strong>
              <small>{NOMBRE_ROL[usuario?.rol]}</small>
            </div>
          </div>
          <button className="btn btn-oscuro btn-bloque" onClick={() => logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="sidebar-fondo" onClick={() => setAbierto(false)} />
      <div className="principal">
        <header className="topbar">
          <button className="btn-icono menu-btn" onClick={() => setAbierto(!abierto)} aria-label="Menú">
            ☰
          </button>
          <div className="topbar-turno">
            <small>Turno</small> <TurnoResumen turno={turno} />
          </div>
          <Reloj />
        </header>
        <main className="contenido">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
