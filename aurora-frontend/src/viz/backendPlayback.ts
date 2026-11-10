import type { CicloDto, FaseSemaforica, SimulacionResultado } from "../types/aurora";
import type { SceneStore } from "./SceneStore";
import { TrafficKinematics } from "./TrafficKinematics";
import type { Approach } from "./types";

/**
 * Reproduce, como animacion, una respuesta REAL del backend
 * (POST /api/simulaciones). Que se dibuja y cuando sale de los datos del backend:
 *  - estadoInicial        -> vehiculos en cola al arrancar.
 *  - faseActiva           -> que semaforos estan en verde en cada ciclo.
 *  - duracionAccion       -> cuanto dura el ciclo (escalado por timeScale).
 *  - vehiculosDescargados -> cuantos vehiculos cruzan en ese ciclo.
 *  - colas al cierre      -> cuantos vehiculos llegan en ese ciclo
 *                            (llegadas = cola_nueva - (cola_previa - descargados)).
 *
 * Lo que NO viene del backend y es solo representacion visual: la posicion
 * exacta de cada vehiculo, el reparto de una direccion entre sus dos accesos
 * (N/S o E/O, el backend solo conoce "Norte-Sur" y "Este-Oeste"), la
 * velocidad de animacion y el instante dentro del ciclo en que sale cada auto.
 * El backend tampoco emite semaforo amarillo, asi que aqui no se inventa.
 */

const POOL: Record<FaseSemaforica, readonly [Approach, Approach]> = {
  NORTE_SUR: ["N", "S"],
  ESTE_OESTE: ["E", "W"],
};

/** Segundos de reproduccion que se siguen animando tras el ultimo ciclo para que los autos terminen de salir. */
const DRAIN_SECONDS = 2.5;
/**
 * Segundos simulados que tarda en salir cada vehiculo. Es el mismo valor que usa el backend
 * (segundosPorVehiculoDescarga en ConfiguracionAurora): la descarga de un ciclo es duracion / 2,
 * asi que soltar un auto cada 2 s lo reparte a lo largo de todo el verde, sin tramos muertos.
 */
const DISCHARGE_SECONDS = 2;

export interface DibujadoEnCola {
  ns: number;
  eo: number;
}

export interface PlaybackHooks {
  onCycleStart?: (index: number, total: number, ciclo: CicloDto) => void;
  onCycleEnd?: (index: number, total: number, ciclo: CicloDto, dibujado: DibujadoEnCola) => void;
  onFinish?: () => void;
}

export interface PlaybackOptions {
  /** Segundos simulados por segundo de reproduccion (x4 = un ciclo de 24 s dura 6 s en pantalla). */
  timeScale: number;
  /** Cadencia de actualizacion de datos hacia el canvas. */
  tickMs?: number;
  hooks?: PlaybackHooks;
}

interface ScheduledEvent {
  at: number;
  kind: "release" | "arrive";
  dir: FaseSemaforica;
}

function shortest(kin: TrafficKinematics, pool: readonly [Approach, Approach]): Approach {
  return kin.queueLength(pool[1]) < kin.queueLength(pool[0]) ? pool[1] : pool[0];
}

function longest(kin: TrafficKinematics, pool: readonly [Approach, Approach]): Approach {
  return kin.queueLength(pool[1]) > kin.queueLength(pool[0]) ? pool[1] : pool[0];
}

export class BackendPlayback {
  private readonly store: SceneStore;
  private readonly resultado: SimulacionResultado;
  private readonly timeScale: number;
  private readonly tickMs: number;
  private readonly hooks: PlaybackHooks;

  private kin = new TrafficKinematics();
  private timer: number | null = null;
  private completedWait = 0;
  private completedCrossed = 0;
  private t = 0;
  private index = 0;
  private cycleEnd = 0;
  private events: ScheduledEvent[] = [];
  private drainUntil: number | null = null;

  constructor(store: SceneStore, resultado: SimulacionResultado, options: PlaybackOptions) {
    this.store = store;
    this.resultado = resultado;
    this.timeScale = options.timeScale;
    this.tickMs = options.tickMs ?? 100;
    this.hooks = options.hooks ?? {};
  }

  start(): void {
    this.stop();
    this.store.clear();
    this.kin = new TrafficKinematics();
    this.t = 0;
    this.completedWait = 0;
    this.completedCrossed = 0;
    this.index = 0;
    this.events = [];
    this.drainUntil = null;

    const inicial = this.resultado.estadoInicial;
    for (let i = 0; i < inicial.vehiculosEsperaNorteSur; i++) {
      this.kin.spawnQueued(shortest(this.kin, POOL.NORTE_SUR));
    }
    for (let i = 0; i < inicial.vehiculosEsperaEsteOeste; i++) {
      this.kin.spawnQueued(shortest(this.kin, POOL.ESTE_OESTE));
    }

    if (this.resultado.ciclos.length === 0) {
      this.store.push(this.kin.snapshot());
      this.hooks.onFinish?.();
      return;
    }

    this.beginCycle(0);
    this.publishMetrics();
    this.store.push(this.kin.snapshot());
    this.publishPhase();
    this.timer = window.setInterval(this.tick, this.tickMs);
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private previousQueues(index: number): { ns: number; eo: number } {
    if (index === 0) {
      return {
        ns: this.resultado.estadoInicial.vehiculosEsperaNorteSur,
        eo: this.resultado.estadoInicial.vehiculosEsperaEsteOeste,
      };
    }
    const previo = this.resultado.ciclos[index - 1];
    return { ns: previo.vehiculosEsperaNorteSur, eo: previo.vehiculosEsperaEsteOeste };
  }

  private beginCycle(index: number): void {
    const ciclo = this.resultado.ciclos[index];
    this.index = index;

    const start = this.t;
    const duration = ciclo.duracionAccionSegundos / this.timeScale;
    this.cycleEnd = start + duration;

    const nsGreen = ciclo.faseActiva === "NORTE_SUR";
    this.kin.signals = {
      N: nsGreen ? "green" : "red",
      S: nsGreen ? "green" : "red",
      E: nsGreen ? "red" : "green",
      W: nsGreen ? "red" : "green",
    };

    const descargados = ciclo.vehiculosDescargados;
    // Un auto cada DISCHARGE_SECONDS simulados; si por algun motivo no cupieran en el verde,
    // se reparten uniformemente para que todos salgan dentro del ciclo.
    const pasoSim = Math.min(DISCHARGE_SECONDS, ciclo.duracionAccionSegundos / Math.max(descargados, 1));
    const paso = pasoSim / this.timeScale;
    for (let k = 0; k < descargados; k++) {
      this.events.push({
        at: start + k * paso,
        kind: "release",
        dir: ciclo.faseActiva,
      });
    }

    const previo = this.previousQueues(index);
    const llegadasNS = Math.max(
      0,
      ciclo.vehiculosEsperaNorteSur - (previo.ns - (nsGreen ? descargados : 0)),
    );
    const llegadasEO = Math.max(
      0,
      ciclo.vehiculosEsperaEsteOeste - (previo.eo - (nsGreen ? 0 : descargados)),
    );
    for (let j = 0; j < llegadasNS; j++) {
      this.events.push({ at: start + ((j + 1) / (llegadasNS + 1)) * duration, kind: "arrive", dir: "NORTE_SUR" });
    }
    for (let j = 0; j < llegadasEO; j++) {
      this.events.push({ at: start + ((j + 1) / (llegadasEO + 1)) * duration, kind: "arrive", dir: "ESTE_OESTE" });
    }
    this.events.sort((a, b) => a.at - b.at);

    this.hooks.onCycleStart?.(index, this.resultado.ciclos.length, ciclo);
  }

  private endCycle(): void {
    const ciclo = this.resultado.ciclos[this.index];
    const dibujado: DibujadoEnCola = {
      ns: this.kin.queueLength("N") + this.kin.queueLength("S"),
      eo: this.kin.queueLength("E") + this.kin.queueLength("W"),
    };
    this.completedWait = ciclo.tiempoEsperaAcumuladoVehSeg;
    this.completedCrossed += ciclo.vehiculosDescargados;
    this.hooks.onCycleEnd?.(this.index, this.resultado.ciclos.length, ciclo, dibujado);

    const next = this.index + 1;
    if (next < this.resultado.ciclos.length) {
      this.beginCycle(next);
      this.publishMetrics();
    } else {
      this.publishMetrics();
      this.drainUntil = this.t + DRAIN_SECONDS;
    }
  }

  private processEvents(): void {
    while (this.events.length > 0 && this.events[0].at <= this.t) {
      const event = this.events.shift();
      if (!event) break;
      const pool = POOL[event.dir];
      if (event.kind === "release") {
        this.kin.release(longest(this.kin, pool));
      } else {
        this.kin.spawnArriving(shortest(this.kin, pool));
      }
    }
  }

  private publishMetrics(): void {
    const total = this.resultado.ciclos.length;
    this.store.metrics = {
      ciclo: Math.min(this.index + 1, total),
      total,
      esperaAcum: this.completedWait,
      cruzaron: this.completedCrossed,
    };
  }

  private publishPhase(): void {
    if (this.drainUntil !== null) {
      this.store.phase = { label: null, state: "done", endsAtMs: 0, timeScale: this.timeScale, totalSim: 0 };
      return;
    }
    const ciclo = this.resultado.ciclos[this.index];
    const restanteReal = Math.max(0, this.cycleEnd - this.t);
    this.store.phase = {
      label: ciclo.faseActiva === "NORTE_SUR" ? "Norte–Sur" : "Este–Oeste",
      state: "green",
      endsAtMs: performance.now() + restanteReal * 1000,
      timeScale: this.timeScale,
      totalSim: ciclo.duracionAccionSegundos,
    };
  }

  private tick = (): void => {
    const dt = this.tickMs / 1000;
    this.t += dt;
    this.processEvents();
    this.kin.step(dt);
    this.store.push(this.kin.snapshot());
    this.publishPhase();

    if (this.drainUntil !== null) {
      if (this.t >= this.drainUntil) {
        this.stop();
        this.hooks.onFinish?.();
      }
      return;
    }
    if (this.t >= this.cycleEnd) this.endCycle();
  };
}
