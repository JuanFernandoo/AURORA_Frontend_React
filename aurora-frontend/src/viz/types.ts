/**
 * Contrato de datos del visualizador (gemelo digital).
 *
 * El componente <TrafficCanvas> solo conoce este contrato: una lista de
 * vehiculos con posicion (x, y) en el "mundo" de 800x800 unidades, un angulo
 * en radianes (0 = apunta al este, PI/2 = apunta al sur, porque el eje Y del
 * canvas crece hacia abajo) y el color de cada semaforo.
 *
 * IMPORTANTE: el backend Java actual NO emite este formato (solo entrega
 * conteos de cola por direccion y fase activa por ciclo). Las dos fuentes
 * que alimentan este contrato (backendPlayback.ts y demoFeed.ts) estan
 * documentadas en TRAZABILIDAD.md.
 */

/** Acceso a la interseccion, nombrado por el lado del que llegan los vehiculos. */
export type Approach = "N" | "S" | "E" | "W";

export const APPROACHES: readonly Approach[] = ["N", "S", "E", "W"];

export type SignalColor = "green" | "yellow" | "red";

export type SignalMap = Record<Approach, SignalColor>;

export interface VehicleState {
  id: number;
  x: number;
  y: number;
  /** Radianes. 0 = este, PI/2 = sur, PI = oeste, -PI/2 = norte. */
  angle: number;
  /** Indice de color de carroceria: 0 = Norte-Sur, 1 = Este-Oeste. */
  color: number;
}

export interface SceneSnapshot {
  vehicles: VehicleState[];
  signals: SignalMap;
  /** Vehiculos detenidos en cola por acceso (para los contadores del canvas). */
  queues: Record<Approach, number>;
}

/** Metricas que muestra el panel dentro del canvas. Vienen de la respuesta del backend (ciclos ya cerrados). */
export interface MetricsInfo {
  /** Ciclo en curso (1..total). */
  ciclo: number;
  total: number;
  /** Espera acumulada del backend (veh·s) al cierre del ultimo ciclo completado. */
  esperaAcum: number;
  /** Vehiculos descargados acumulados (suma de vehiculosDescargados de los ciclos completados). */
  cruzaron: number;
}

/** Que fase esta activa y cuanto falta. Lo lee el indicador de fase (no el canvas). */
export interface PhaseInfo {
  /** Texto corto, p. ej. "Norte–Sur". null = sin fase (reproduccion terminada). */
  label: string | null;
  state: "green" | "yellow" | "allred" | "done";
  /** Instante (performance.now()) en que termina la fase, en tiempo real de pantalla. */
  endsAtMs: number;
  /** Segundos simulados por segundo real (para mostrar segundos simulados restantes). */
  timeScale: number;
  /** Duracion total de la fase en segundos simulados. */
  totalSim: number;
}

/** Color de carroceria por sentido de circulacion: 0 = Norte-Sur, 1 = Este-Oeste. */
export const CAR_COLOR_COUNT = 2;

export function allRed(): SignalMap {
  return { N: "red", S: "red", E: "red", W: "red" };
}
