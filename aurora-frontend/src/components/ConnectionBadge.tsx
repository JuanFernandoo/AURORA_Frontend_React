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
  verificando: "Conectando",
  en_linea: "Backend conectado",
  fuera_de_linea: "Sin conexión, modo demo",
};

/** Estado de conexión en una sola línea. El detalle técnico queda en el atributo title y en «Detalles técnicos». */
export function ConnectionBadge({ estado, salud, ultimoError, baseUrl, reintentar }: Props) {
  const detalle =
    estado === "en_linea" && salud
      ? `${salud.servicio} v${salud.version} (${salud.status})`
      : estado === "fuera_de_linea" && ultimoError
        ? ultimoError
        : `GET ${baseUrl}/api/health`;

  return (
    <div className={`estado estado--${estado}`} role="status" title={detalle}>
      <span className="estado__punto" aria-hidden="true" />
      <span>{ETIQUETAS[estado]}</span>
      {estado === "verificando" && <span className="estado__nota">puede tardar hasta un minuto</span>}
      {estado === "fuera_de_linea" && (
        <button type="button" className="enlace" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}
