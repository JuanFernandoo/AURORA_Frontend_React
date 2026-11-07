import type { EstadoConexion } from "../hooks/useBackendConnection";
import type { HealthResponse } from "../types/aurora";

interface Props {
  estado: EstadoConexion;
  salud: HealthResponse | null;
  ultimoError: string | null;
  baseUrl: string;
  reintentar: () => void;
}

const ETIQUETAS: Record<EstadoConexion, string> = {
  verificando: "Verificando conexión…",
  en_linea: "Backend Java conectado",
  fuera_de_linea: "Backend Java no disponible — mostrando modo DEMO",
};

export function ConnectionBadge({ estado, salud, ultimoError, baseUrl, reintentar }: Props) {
  return (
    <div className={`connection-badge connection-badge--${estado}`}>
      <div className="connection-badge__texto">
        <strong>{ETIQUETAS[estado]}</strong>
        <span className="connection-badge__url">GET {baseUrl}/api/health</span>
        {estado === "en_linea" && salud && (
          <span className="connection-badge__detalle">
            {salud.servicio} v{salud.version} · status: {salud.status}
          </span>
        )}
        {estado === "fuera_de_linea" && ultimoError && (
          <span className="connection-badge__detalle">{ultimoError}</span>
        )}
      </div>
      <button type="button" onClick={reintentar} className="connection-badge__boton">
        Reintentar conexión
      </button>
    </div>
  );
}
