import type {
  CompararResultado,
  ConfigResponse,
  ControladoresResponse,
  HealthResponse,
  SimulacionResultado,
} from "../types/aurora";

/**
 * MUESTRA DEMO — NO SON DATOS EN VIVO.
 *
 * Estos objetos son una COPIA EXACTA, capturada textualmente, de respuestas
 * reales que el backend Java (com.aurora.api.AuroraApiServer) devolvio
 * durante la verificacion de esta integracion (ver TRAZABILIDAD.md para los
 * comandos curl exactos y sus salidas completas). No es un calculo hecho en
 * el frontend ni una reimplementacion de la logica de negocio de AURORA en
 * TypeScript: es un "congelado" de una respuesta real, para que la interfaz
 * sea exhibible incluso cuando el backend Java no esta corriendo.
 *
 * La interfaz SIEMPRE distingue visualmente cuando estos datos estan en uso
 * (ver FuenteDatos = "demo" en los componentes) en vez de presentarlos como
 * si vinieran de una ejecucion real del backend.
 */

export const DEMO_HEALTH: HealthResponse = {
  status: "ok",
  servicio: "aurora-java-api",
  version: "1.0.0",
};

export const DEMO_CONFIG: ConfigResponse = {
  duracionFaseFijaSegundos: 15,
  duracionMinimaAdaptativaSegundos: 10,
  duracionMaximaAdaptativaSegundos: 40,
  umbralCongestionVehiculos: 8,
  numeroCiclosSimulacion: 15,
  segundosPorVehiculoDescarga: 2,
  llegadaVehiculosNorteSurPorCiclo: 3,
  llegadaVehiculosEsteOestePorCiclo: 2,
  vehiculosInicialesNorteSur: 12,
  vehiculosInicialesEsteOeste: 8,
};

export const DEMO_CONTROLADORES: ControladoresResponse = {
  tipos: ["CICLO_FIJO", "ADAPTATIVO"],
};

const DEMO_CICLO_FIJO_2_CICLOS: SimulacionResultado = {
  tipoControlador: "CICLO_FIJO",
  nombreEstrategia: "Ciclo Fijo",
  estadoInicial: { vehiculosEsperaNorteSur: 12, vehiculosEsperaEsteOeste: 8 },
  ciclos: [
    {
      numeroCiclo: 1,
      faseActiva: "NORTE_SUR",
      duracionAccionSegundos: 15,
      vehiculosDescargados: 7,
      vehiculosEsperaNorteSur: 8,
      vehiculosEsperaEsteOeste: 10,
      longitudColaTotal: 18,
      tiempoEsperaAcumuladoVehSeg: 270.0,
    },
    {
      numeroCiclo: 2,
      faseActiva: "ESTE_OESTE",
      duracionAccionSegundos: 15,
      vehiculosDescargados: 7,
      vehiculosEsperaNorteSur: 11,
      vehiculosEsperaEsteOeste: 5,
      longitudColaTotal: 16,
      tiempoEsperaAcumuladoVehSeg: 510.0,
    },
  ],
  metricas: {
    ciclosProcesados: 2,
    longitudColaPromedio: 17.0,
    longitudColaMaxima: 18,
    tiempoEsperaAcumuladoVehSeg: 510.0,
    vehiculosPendientesFinal: 16,
  },
};

const DEMO_ADAPTATIVO_2_CICLOS: SimulacionResultado = {
  tipoControlador: "ADAPTATIVO",
  nombreEstrategia: "Adaptativo (heuristica)",
  estadoInicial: { vehiculosEsperaNorteSur: 12, vehiculosEsperaEsteOeste: 8 },
  ciclos: [
    {
      numeroCiclo: 1,
      faseActiva: "NORTE_SUR",
      duracionAccionSegundos: 24,
      vehiculosDescargados: 12,
      vehiculosEsperaNorteSur: 3,
      vehiculosEsperaEsteOeste: 10,
      longitudColaTotal: 13,
      tiempoEsperaAcumuladoVehSeg: 312.0,
    },
    {
      numeroCiclo: 2,
      faseActiva: "ESTE_OESTE",
      duracionAccionSegundos: 20,
      vehiculosDescargados: 10,
      vehiculosEsperaNorteSur: 6,
      vehiculosEsperaEsteOeste: 2,
      longitudColaTotal: 8,
      tiempoEsperaAcumuladoVehSeg: 472.0,
    },
  ],
  metricas: {
    ciclosProcesados: 2,
    longitudColaPromedio: 10.5,
    longitudColaMaxima: 13,
    tiempoEsperaAcumuladoVehSeg: 472.0,
    vehiculosPendientesFinal: 8,
  },
};

export const DEMO_COMPARAR_2_CICLOS: CompararResultado = {
  cicloFijo: DEMO_CICLO_FIJO_2_CICLOS,
  adaptativo: DEMO_ADAPTATIVO_2_CICLOS,
  diferenciaPorcentualEsperaAcumulada: 7.5,
  diferenciaCalculable: true,
};

const DEMO_ADAPTATIVO_3_CICLOS: SimulacionResultado = {
  tipoControlador: "ADAPTATIVO",
  nombreEstrategia: "Adaptativo (heuristica)",
  estadoInicial: { vehiculosEsperaNorteSur: 12, vehiculosEsperaEsteOeste: 8 },
  ciclos: [
    ...DEMO_ADAPTATIVO_2_CICLOS.ciclos,
    {
      numeroCiclo: 3,
      faseActiva: "NORTE_SUR",
      duracionAccionSegundos: 10,
      vehiculosDescargados: 5,
      vehiculosEsperaNorteSur: 4,
      vehiculosEsperaEsteOeste: 4,
      longitudColaTotal: 8,
      tiempoEsperaAcumuladoVehSeg: 552.0,
    },
  ],
  metricas: {
    ciclosProcesados: 3,
    longitudColaPromedio: 9.666666666666666,
    longitudColaMaxima: 13,
    tiempoEsperaAcumuladoVehSeg: 552.0,
    vehiculosPendientesFinal: 8,
  },
};

/** Devuelve una muestra DEMO para una sola estrategia, sea cual fuere el numero de ciclos pedido (se ignora: es una muestra fija). */
export function obtenerMuestraDemoSimulacion(tipoControlador: "CICLO_FIJO" | "ADAPTATIVO"): SimulacionResultado {
  return tipoControlador === "CICLO_FIJO" ? DEMO_CICLO_FIJO_2_CICLOS : DEMO_ADAPTATIVO_3_CICLOS;
}

/** Devuelve la muestra DEMO de la comparacion entre ambas estrategias. */
export function obtenerMuestraDemoComparacion(): CompararResultado {
  return DEMO_COMPARAR_2_CICLOS;
}
