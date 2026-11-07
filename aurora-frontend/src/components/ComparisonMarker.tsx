import { lideDeComparacion } from "../services/comparacion";
import type { ProgresoComparacion } from "../services/comparacion";
import type { CompararResultado } from "../types/aurora";

export function ComparisonMarker({
  comparacion,
  progreso,
}: {
  comparacion: CompararResultado;
  progreso: ProgresoComparacion;
}) {
  const total = comparacion.cicloFijo.ciclos.length;
  const estado = lideDeComparacion(comparacion, progreso);

  if (!estado) {
    return (
      <div className="comparacion-marcador" role="status">
        Esperando que ambas estrategias completen su primer ciclo…
      </div>
    );
  }

  const nombre =
    estado.lider === "fijo"
      ? comparacion.cicloFijo.nombreEstrategia
      : estado.lider === "adaptativo"
        ? comparacion.adaptativo.nombreEstrategia
        : null;
  const final = estado.n >= total;

  return (
    <div className="comparacion-marcador" role="status">
      <strong>
        {final ? "Resultado final" : `Parcial: ${estado.n}/${total} ciclos`} ·{" "}
        {nombre ? `menor espera: ${nombre}` : "empate"}
      </strong>
      <span>
        {comparacion.cicloFijo.nombreEstrategia} {estado.fijo.toFixed(1)} veh·s ·{" "}
        {comparacion.adaptativo.nombreEstrategia} {estado.adaptativo.toFixed(1)} veh·s
      </span>
      {!final && (
        <small>
          Se compara con el mismo numero de ciclos completos; al inicio el adaptativo puede ir por detras y
          mejorar despues.
        </small>
      )}
    </div>
  );
}
