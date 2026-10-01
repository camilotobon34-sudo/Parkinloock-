import { useCallback, useEffect, useRef, useState } from 'react'

/** Ejecuta una consulta al montar (y cuando cambian las dependencias) y expone recargar(). */
export function useCarga(fn, deps = []) {
  const [estado, setEstado] = useState({ data: null, error: null, cargando: true })
  const fnRef = useRef(fn)
  fnRef.current = fn

  const recargar = useCallback(async () => {
    setEstado((s) => ({ ...s, cargando: true, error: null }))
    try {
      const data = await fnRef.current()
      setEstado({ data, error: null, cargando: false })
      return data
    } catch (error) {
      setEstado((s) => ({ ...s, error, cargando: false }))
      return null
    }
  }, [])

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { ...estado, recargar }
}
