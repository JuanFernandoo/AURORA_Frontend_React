import { lideDeComparacion } from "../services/comparacion";
import type { ProgresoComparacion } from "../services/comparacion";
import type { CompararResultado } from "../types/aurora";

/**
 * Titular en lenguaje sencillo. Al terminar, el porcentaje es el que calcula el backend (no se recalcula
 * aqui). Mientras corre, solo se muestra quien lleva menos espera con el mismo numero de ciclos.
 */
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
        <strong>Comparando… esperando que ambos semáforos completen su primer ciclo.</strong>
      </div>
    );
  }

  const final = estado.n >= total;
  const pct = comparacion.diferenciaPorcentualEsperaAcumulada;

  let titular: string;
  if (final && comparacion.diferenciaCalculable && pct !== null && pct > 0) {
    titular = `Con el semáforo adaptativo, los conductores esperaron un ${pct.toFixed(1).replace(".", ",")} % menos que con el ciclo fijo.`;
  } else if (final && comparacion.diferenciaCalculable && pct !== null && pct < 0) {
    titular = `En este escenario el semáforo adaptativo esperó un ${Math.abs(pct).toFixed(1).replace(".", ",")} % más que el ciclo fijo.`;
  } else if (final) {
    titular = "Ambos semáforos obtuvieron la misma espera en este escenario.";
  } else if (estado.lider === "empate") {
    titular = `Parcial (ciclo ${estado.n} de ${total}): van empatados.`;
  } else {
    const nombre = estado.lider === "fijo" ? "El ciclo fijo" : "El semáforo adaptativo";
    titular = `Parcial (ciclo ${estado.n} de ${total}): ${nombre} lleva menos espera.`;
  }

  return (
    <div className={final ? "comparacion-marcador comparacion-marcador--final" : "comparacion-marcador"} role="status">
      <strong className="comparacion-marcador__titular">{titular}</strong>
      <span>
        Espera total sumada de todos los vehículos hasta el ciclo {estado.n}: ciclo fijo{" "}
        <b>{Math.round(estado.fijo).toLocaleString("es-CO")}</b> · adaptativo{" "}
        <b>{Math.round(estado.adaptativo).toLocaleString("es-CO")}</b> (vehículo-segundos, veh·s)
      </span>
      {!final && (
        <small>
          Se compara con el mismo número de ciclos completos. Al inicio el adaptativo puede ir por detrás y
          mejorar después.
        </small>
      )}
    </div>
  );
}
