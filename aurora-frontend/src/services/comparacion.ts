import type { CompararResultado } from "../types/aurora";

export interface ProgresoComparacion {
  fijo: number;
  adaptativo: number;
}

/**
 * Cual estrategia lleva menos espera acumulada, comparadas tras el MISMO numero de ciclos completos
 * (el minimo que ya cerraron ambas reproducciones). Los valores salen tal cual de la respuesta del backend;
 * este componente solo elige el menor, no calcula metricas.
 */
export function lideDeComparacion(
  comparacion: CompararResultado,
  progreso: ProgresoComparacion,
): { n: number; fijo: number; adaptativo: number; lider: "fijo" | "adaptativo" | "empate" } | null {
  const n = Math.min(progreso.fijo, progreso.adaptativo);
  if (n < 1) return null;
  const fijo = comparacion.cicloFijo.ciclos[n - 1]?.tiempoEsperaAcumuladoVehSeg;
  const adaptativo = comparacion.adaptativo.ciclos[n - 1]?.tiempoEsperaAcumuladoVehSeg;
  if (fijo === undefined || adaptativo === undefined) return null;
  const lider = fijo === adaptativo ? "empate" : fijo < adaptativo ? "fijo" : "adaptativo";
  return { n, fijo, adaptativo, lider };
}
