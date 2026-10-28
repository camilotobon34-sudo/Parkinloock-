import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { Cargando } from './components/ui.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { ToastProvider } from './context/ToastContext.jsx'
import Alertas from './pages/Alertas.jsx'
import Cliente from './pages/Cliente.jsx'
import Clientes from './pages/Clientes.jsx'
import Entrada from './pages/Entrada.jsx'
import Historial from './pages/Historial.jsx'
import Login from './pages/Login.jsx'
import Mensualidades from './pages/Mensualidades.jsx'
import Panel from './pages/Panel.jsx'
import Personas from './pages/Personas.jsx'
import Reservas from './pages/Reservas.jsx'
import Salida from './pages/Salida.jsx'
import Tarifas from './pages/Tarifas.jsx'
import Turnos from './pages/Turnos.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Vehiculos from './pages/Vehiculos.jsx'

function RutaProtegida({ children }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()
  if (cargando) return <Cargando texto="Verificando sesión…" />
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />
  return children
}

function SoloAdmin({ children }) {
  const { esAdmin } = useAuth()
  return esAdmin ? children : <Navigate to="/" replace />
}

function RutaLogin() {
  const { usuario, cargando } = useAuth()
  if (cargando) return <Cargando texto="Verificando sesión…" />
  if (!usuario) return <Login />
  const destino = usuario.rol === 'CLIENTE' ? '/cliente' : sessionStorage.getItem('parkinlock_destino') || '/'
  return <Navigate to={destino} replace />
}

function ZonaPersonal() {
  const { usuario } = useAuth()
  if (usuario?.rol === 'CLIENTE') return <Navigate to="/cliente" replace />
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<RutaLogin />} />
            <Route
              path="/cliente"
              element={
                <RutaProtegida>
                  <Cliente />
                </RutaProtegida>
              }
            />
            <Route
              element={
                <RutaProtegida>
                  <ZonaPersonal />
                </RutaProtegida>
              }
            >
              <Route index element={<Panel />} />
              <Route path="entrada" element={<Entrada />} />
              <Route path="salida" element={<Salida />} />
              <Route path="vehiculos" element={<Vehiculos />} />
              <Route path="reservas" element={<Reservas />} />
              <Route path="mensualidades" element={<Mensualidades />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="historial" element={<Historial />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="turnos" element={<Turnos />} />
              <Route path="tarifas" element={<SoloAdmin><Tarifas /></SoloAdmin>} />
              <Route path="usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
              <Route path="personas" element={<SoloAdmin><Personas /></SoloAdmin>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
