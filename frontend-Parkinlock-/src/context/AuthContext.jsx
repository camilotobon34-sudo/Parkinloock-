import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth, clearToken, getToken, onNoAutorizado, setToken } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(Boolean(getToken()))
  const [aviso, setAviso] = useState(null)

  const logout = useCallback((mensaje = null) => {
    clearToken()
    sessionStorage.removeItem('parkinlock_destino')
    setPerfil(null)
    setAviso(mensaje)
    navigate('/login', { replace: true })
  }, [navigate])

  const refrescar = useCallback(async () => {
    const p = await auth.me()
    setPerfil(p)
    return p
  }, [])

  useEffect(() => {
    onNoAutorizado((mensaje) => logout(mensaje))
    if (!getToken()) {
      setCargando(false)
      return
    }

    let cancelado = false
    const verificar = async ({ silencioso = false } = {}) => {
      try {
        await refrescar()
        if (!cancelado) setAviso(null)
      } catch (err) {
        if (cancelado) return
        // Solo cerrar sesión si el token es inválido; errores de red/DB no deben expulsar al operador.
        if (err?.status === 401) logout(err.message)
        else if (!silencioso) setAviso(err?.message || 'Conexión inestable. Se reintentará automáticamente.')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    verificar()
    const id = setInterval(() => verificar({ silencioso: true }), 60_000)
    const alVisible = () => {
      if (document.visibilityState === 'visible') verificar({ silencioso: true })
    }
    document.addEventListener('visibilitychange', alVisible)
    return () => {
      cancelado = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVisible)
    }
  }, [logout, refrescar])

  const login = useCallback(
    async ({ usuario, contrasena, rol, recordar }) => {
      const r = await auth.login(usuario, contrasena, rol)
      setToken(r.token, recordar)
      setAviso(null)
      return refrescar()
    },
    [refrescar],
  )

  const loginCliente = useCallback(
    async ({ usuario, nombre, correo, recordar }) => {
      const r = await auth.loginCliente(usuario, nombre, correo)
      setToken(r.token, recordar)
      setAviso(null)
      return refrescar()
    },
    [refrescar],
  )

  const registrarCliente = useCallback(
    async ({ usuario, nombre, correo, contrasena, recordar }) => {
      const r = await auth.registrarCliente(usuario, nombre, correo, contrasena)
      setToken(r.token, recordar)
      setAviso(null)
      return refrescar()
    },
    [refrescar],
  )

  const valor = useMemo(
    () => ({
      usuario: perfil?.usuario ?? null,
      permisos: perfil?.permisos ?? [],
      turno: perfil?.turno_activo ?? null,
      esAdmin: perfil?.usuario?.rol === 'ADMINISTRADOR',
      cargando,
      aviso,
      login,
      loginCliente,
      registrarCliente,
      logout,
      refrescar,
    }),
    [perfil, cargando, aviso, login, loginCliente, registrarCliente, logout, refrescar],
  )

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

const sesionVacia = {
  usuario: null,
  permisos: [],
  turno: null,
  esAdmin: false,
  cargando: true,
  aviso: null,
  login: async () => {},
  loginCliente: async () => {},
  registrarCliente: async () => {},
  logout: () => {},
  refrescar: async () => {},
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext) ?? sesionVacia
