import { NOMBRE_TIPO } from '../utils/format.js'

/**
 * Mapa de espacios con los datos reales de GET /espacios.
 * Si se pasa onSeleccionar, los espacios seleccionables (filtro) quedan como botones.
 */
export function MapaEspacios({ espacios = [], seleccionado, onSeleccionar, seleccionable = () => false }) {
  const grupos = {}
  for (const e of espacios) (grupos[e.tipo] ??= []).push(e)
  return (
    <div className="mapa">
      {Object.entries(grupos).map(([tipo, lista]) => (
        <div key={tipo} className="mapa-grupo">
          <div className="mapa-titulo">{NOMBRE_TIPO[tipo] ?? tipo}</div>
          <div className="mapa-grid">
            {lista.map((e) => {
              const puede = onSeleccionar && seleccionable(e)
              return (
                <button
                  key={e.id_espacio}
                  type="button"
                  className={`espacio espacio-${e.estado.toLowerCase()} ${seleccionado === e.id_espacio ? 'espacio-sel' : ''}`}
                  disabled={!puede}
                  onClick={() => puede && onSeleccionar(e)}
                  title={`${e.codigo} · ${e.estado}${e.placa ? ` · ${e.placa}` : ''}`}
                >
                  <strong>{e.codigo}</strong>
                  <small>{e.placa ?? e.estado.toLowerCase()}</small>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="mapa-leyenda">
        <span>
          <i className="dot dot-disponible" /> Disponible
        </span>
        <span>
          <i className="dot dot-ocupado" /> Ocupado
        </span>
        <span>
          <i className="dot dot-reservado" /> Reservado
        </span>
      </div>
    </div>
  )
}
