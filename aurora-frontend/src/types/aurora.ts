/**
 * Tipos que reflejan EXACTAMENTE las respuestas reales observadas al
 * ejecutar el backend Java (com.aurora.api.AuroraApiServer) en este mismo
 * entorno de desarrollo, con los siguientes comandos de verificacion:
 *
 *   curl http://localhost:8100/api/health
 *   curl http://localhost:8100/api/config
 *   curl http://localhost:8100/api/controladores
 *   curl -X POST http://localhost:8100/api/simulaciones -d '{"tipoControlador":"ADAPTATIVO","numeroCiclos":3}'
 *   curl -X POST http://localhost:8100/api/simulaciones/comparar -d '{"numeroCiclos":2}'
 *
 * No son tipos especulativos: cada campo aqui existio en una respuesta JSON
 * real capturada de esa ejecucion (ver TRAZABILIDAD.md en la raiz del
 * proyecto para el detalle completo de esa verificacion).
 */

export type TipoControlador = "CICLO_FIJO" | "ADAPTATIVO";

export type FaseSemaforica = "NORTE_SUR" | "ESTE_OESTE";

export interface HealthResponse {
  status: string;
  servicio: string;
  version: string;
}

export interface ConfigResponse {
  duracionFaseFijaSegundos: number;
  duracionMinimaAdaptativaSegundos: number;
  duracionMaximaAdaptativaSegundos: number;
  umbralCongestionVehiculos: number;
  numeroCiclosSimulacion: number;
  segundosPorVehiculoDescarga: number;
  llegadaVehiculosNorteSurPorCiclo: number;
  llegadaVehiculosEsteOestePorCiclo: number;
  vehiculosInicialesNorteSur: number;
  vehiculosInicialesEsteOeste: number;
}

export interface ControladoresResponse {
  tipos: TipoControlador[];
}

export interface EstadoTraficoDto {
  vehiculosEsperaNorteSur: number;
  vehiculosEsperaEsteOeste: number;
}

export interface CicloDto {
  numeroCiclo: number;
  faseActiva: FaseSemaforica;
  duracionAccionSegundos: number;
  vehiculosDescargados: number;
  vehiculosEsperaNorteSur: number;
  vehiculosEsperaEsteOeste: number;
  longitudColaTotal: number;
  tiempoEsperaAcumuladoVehSeg: number;
}

export interface MetricasDto {
  ciclosProcesados: number;
  longitudColaPromedio: number;
  longitudColaMaxima: number;
  tiempoEsperaAcumuladoVehSeg: number;
  vehiculosPendientesFinal: number;
}

export interface SimulacionResultado {
  tipoControlador: TipoControlador;
  nombreEstrategia: string;
  estadoInicial: EstadoTraficoDto;
  ciclos: CicloDto[];
  metricas: MetricasDto;
}

export interface CompararResultado {
  cicloFijo: SimulacionResultado;
  adaptativo: SimulacionResultado;
  diferenciaPorcentualEsperaAcumulada: number | null;
  diferenciaCalculable: boolean;
}

export interface ApiErrorBody {
  error: string;
}

/** Identifica si un dato en pantalla vino del backend Java en vivo o de la muestra DEMO. */
export type FuenteDatos = "live" | "demo";
