import type { MetricasDto } from "../types/aurora";

export function MetricsSummary({ metricas }: { metricas: MetricasDto }) {
  return (
    <div className="metrics-summary">
      <div className="metrics-summary__item">
        <span className="metrics-summary__valor">{metricas.ciclosProcesados}</span>
        <span className="metrics-summary__etiqueta">Ciclos procesados</span>
      </div>
      <div className="metrics-summary__item">
        <span className="metrics-summary__valor">{metricas.longitudColaPromedio.toFixed(2)}</span>
        <span className="metrics-summary__etiqueta">Cola promedio (veh)</span>
      </div>
      <div className="metrics-summary__item">
        <span className="metrics-summary__valor">{metricas.longitudColaMaxima}</span>
        <span className="metrics-summary__etiqueta">Cola máxima (veh)</span>
      </div>
      <div className="metrics-summary__item">
        <span className="metrics-summary__valor">{metricas.tiempoEsperaAcumuladoVehSeg.toFixed(1)}</span>
        <span className="metrics-summary__etiqueta">Espera acumulada (vehículo-segundos)</span>
      </div>
      <div className="metrics-summary__item">
        <span className="metrics-summary__valor">{metricas.vehiculosPendientesFinal}</span>
        <span className="metrics-summary__etiqueta">Pendientes al cierre</span>
      </div>
    </div>
  );
}
