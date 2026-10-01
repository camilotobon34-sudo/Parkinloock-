import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="cargando">
      <span className="spinner" /> {texto}
    </div>
  )
}

export function MensajeError({ error, reintentar }) {
  if (!error) return null
  return (
    <div className="aviso aviso-error">
      <span>{error.message ?? String(error)}</span>
      {reintentar && (
        <button className="btn btn-sm" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Aviso({ tipo = 'info', children }) {
  return <div className={`aviso aviso-${tipo}`}>{children}</div>
}

export function Badge({ tono = 'gris', children }) {
  return <span className={`badge badge-${tono}`}>{children}</span>
}

const TONO_ESTADO = {
  DISPONIBLE: 'verde',
  OCUPADO: 'rojo',
  RESERVADO: 'amarillo',
  EN_PARQUEADERO: 'rojo',
  FINALIZADO: 'verde',
  PENDIENTE: 'amarillo',
  CONFIRMADA: 'verde',
  ACTIVA: 'verde',
  'POR VENCER': 'amarillo',
  VENCIDA: 'rojo',
  ACTIVO: 'verde',
  INACTIVO: 'gris',
  ABIERTO: 'verde',
  CERRADO: 'gris',
  ATENDIDA: 'gris',
}
const TEXTO_ESTADO = { EN_PARQUEADERO: 'EN PARQUEADERO' }

export const EstadoBadge = ({ estado }) => <Badge tono={TONO_ESTADO[estado] ?? 'gris'}>{TEXTO_ESTADO[estado] ?? estado}</Badge>

export function Modal({ titulo, onCerrar, children, ancho }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar])
  return createPortal(
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined} role="dialog" aria-modal="true">
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button className="btn-icono" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Campo({ etiqueta, children, ayuda }) {
  return (
    <label className="campo">
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  )
}

export function Cabecera({ titulo, subtitulo, children }) {
  return (
    <div className="cabecera">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="sub">{subtitulo}</p>}
      </div>
      {children && <div className="cabecera-acciones">{children}</div>}
    </div>
  )
}

export function Vacio({ children }) {
  return <div className="vacio">{children}</div>
}
