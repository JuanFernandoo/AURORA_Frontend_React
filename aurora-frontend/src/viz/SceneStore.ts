import type { Approach, MetricsInfo, PhaseInfo, SceneSnapshot, SignalMap } from "./types";
import { allRed } from "./types";

/**
 * Par de poses (anterior -> actual) de un vehiculo. Se calcula UNA vez por
 * actualizacion de datos (p. ej. 5-10 Hz), no por frame, para que el bucle
 * de dibujo (60 fps) solo haga aritmetica sobre arreglos ya preparados.
 */
export interface VehiclePair {
  id: number;
  x0: number;
  y0: number;
  a0: number;
  x1: number;
  y1: number;
  a1: number;
  color: number;
  /** true si el vehiculo esta (casi) detenido: se dibujan luces de freno. */
  braking: boolean;
}

interface LastPose {
  x: number;
  y: number;
  angle: number;
}

const MIN_INTERVAL_MS = 16;
const MAX_INTERVAL_MS = 1000;
/** Por debajo de esta velocidad (unidades/s) se considera que el vehiculo esta detenido. */
const STOPPED_SPEED = 6;

/**
 * Almacen de la escena: recibe snapshots a la cadencia del backend/fuente y
 * expone lo necesario para interpolar entre el snapshot anterior y el actual.
 *
 * Interpolacion: al llegar un snapshot, cada vehiculo parte de su posicion
 * anterior y llega a la nueva en "interval" ms (intervalo medio entre
 * actualizaciones, suavizado con media movil). Esto agrega ~1 intervalo de
 * latencia visual (100 ms a 10 Hz), a cambio de movimiento continuo sin saltos.
 * Los semaforos NO se interpolan: reflejan de inmediato el ultimo estado recibido.
 */
export class SceneStore {
  pairs: VehiclePair[] = [];
  signals: SignalMap = allRed();
  queues: Record<Approach, number> = { N: 0, S: 0, E: 0, W: 0 };
  /** Fase activa; la lee el indicador de fase con su propio bucle (no fuerza redibujar el canvas). */
  phase: PhaseInfo | null = null;
  /** Metricas del backend para el panel del canvas; null en DEMO (no hay metricas reales). */
  metrics: MetricsInfo | null = null;
  /** Se incrementa en cada push; el dibujo lo usa para saltarse frames inactivos. */
  version = 0;

  private lastPoses = new Map<number, LastPose>();
  private currAt = 0;
  private interval = 100;

  push(snapshot: SceneSnapshot, now: number = performance.now()): void {
    if (this.currAt > 0) {
      const elapsed = now - this.currAt;
      if (elapsed > 0) {
        const clamped = Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, elapsed));
        this.interval += (clamped - this.interval) * 0.3;
      }
    }

    const pairs: VehiclePair[] = [];
    const nextPoses = new Map<number, LastPose>();
    for (const v of snapshot.vehicles) {
      const previous = this.lastPoses.get(v.id);
      const x0 = previous ? previous.x : v.x;
      const y0 = previous ? previous.y : v.y;
      const a0 = previous ? previous.angle : v.angle;
      const speed = previous ? (Math.hypot(v.x - x0, v.y - y0) / this.interval) * 1000 : Infinity;
      pairs.push({
        id: v.id,
        x0,
        y0,
        a0,
        x1: v.x,
        y1: v.y,
        a1: v.angle,
        color: v.color,
        braking: speed < STOPPED_SPEED,
      });
      nextPoses.set(v.id, { x: v.x, y: v.y, angle: v.angle });
    }

    this.pairs = pairs;
    this.lastPoses = nextPoses;
    this.signals = snapshot.signals;
    this.queues = snapshot.queues;
    this.currAt = now;
    this.version++;
  }

  /** Progreso 0..1 de la interpolacion en el instante "now" (milisegundos de performance.now()). */
  alphaAt(now: number): number {
    if (this.currAt === 0) return 1;
    return Math.min(1, Math.max(0, (now - this.currAt) / this.interval));
  }

  clear(): void {
    this.pairs = [];
    this.queues = { N: 0, S: 0, E: 0, W: 0 };
    this.phase = null;
    this.metrics = null;
    this.lastPoses = new Map();
    this.signals = allRed();
    this.currAt = 0;
    this.interval = 100;
    this.version++;
  }
}
