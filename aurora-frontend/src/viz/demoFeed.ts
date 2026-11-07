import type { SceneStore } from "./SceneStore";
import { TrafficKinematics } from "./TrafficKinematics";
import type { Approach, SignalMap } from "./types";
import { allRed } from "./types";

/**
 * FUENTE DEMO: flujo sintetico que emite exactamente el contrato del
 * visualizador (x, y, angulo por vehiculo + color de cada semaforo, incluido
 * AMARILLO) a una cadencia baja (5 Hz por defecto) para evidenciar la
 * interpolacion del canvas.
 *
 * NO PROVIENE DEL BACKEND JAVA: las llegadas usan un generador pseudoaleatorio
 * con semilla fija y el plan semaforico es fijo. La interfaz siempre lo
 * etiqueta como DEMO. Sirve para presentar el visualizador cuando el
 * backend no esta disponible.
 */

interface Phase {
  duration: number;
  signals: SignalMap;
  release: readonly Approach[];
}

function signals(ns: "green" | "yellow" | "red", eo: "green" | "yellow" | "red"): SignalMap {
  return { N: ns, S: ns, E: eo, W: eo };
}

const PLAN: readonly Phase[] = [
  { duration: 7, signals: signals("green", "red"), release: ["N", "S"] },
  { duration: 1.5, signals: signals("yellow", "red"), release: [] },
  { duration: 1, signals: allRed(), release: [] },
  { duration: 7, signals: signals("red", "green"), release: ["E", "W"] },
  { duration: 1.5, signals: signals("red", "yellow"), release: [] },
  { duration: 1, signals: allRed(), release: [] },
];

const RELEASE_EVERY = 0.9;
const ARRIVALS_PER_SECOND = 0.45;
const MAX_QUEUE = 9;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DemoFeed {
  private readonly store: SceneStore;
  private readonly tickMs: number;
  private readonly seed: number;

  private kin = new TrafficKinematics();
  private timer: number | null = null;
  private random: () => number = Math.random;
  private phaseIndex = 0;
  private phaseTime = 0;
  private releaseTimer = 0;

  constructor(store: SceneStore, options?: { tickMs?: number; seed?: number }) {
    this.store = store;
    this.tickMs = options?.tickMs ?? 200;
    this.seed = options?.seed ?? 2026;
  }

  start(): void {
    this.stop();
    this.store.clear();
    this.kin = new TrafficKinematics();
    this.random = mulberry32(this.seed);
    this.phaseIndex = 0;
    this.phaseTime = 0;
    this.releaseTimer = 0.2;
    for (const approach of ["N", "S", "E", "W"] as const) {
      for (let i = 0; i < 3; i++) this.kin.spawnQueued(approach);
    }
    this.kin.signals = PLAN[0].signals;
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

  private tick = (): void => {
    const dt = this.tickMs / 1000;

    this.phaseTime += dt;
    if (this.phaseTime >= PLAN[this.phaseIndex].duration) {
      this.phaseTime = 0;
      this.phaseIndex = (this.phaseIndex + 1) % PLAN.length;
      this.releaseTimer = 0.2;
    }
    const phase = PLAN[this.phaseIndex];
    this.kin.signals = phase.signals;

    if (phase.release.length > 0) {
      this.releaseTimer -= dt;
      if (this.releaseTimer <= 0) {
        for (const approach of phase.release) this.kin.release(approach);
        this.releaseTimer = RELEASE_EVERY;
      }
    }

    for (const approach of ["N", "S", "E", "W"] as const) {
      if (this.kin.queueLength(approach) < MAX_QUEUE && this.random() < ARRIVALS_PER_SECOND * dt) {
        this.kin.spawnArriving(approach);
      }
    }

    this.kin.step(dt);
    this.store.push(this.kin.snapshot());
    this.publishPhase();
  };

  private publishPhase(): void {
    const phase = PLAN[this.phaseIndex];
    const nsActive = this.phaseIndex < 3;
    const state = phase.signals.N === "green" || phase.signals.E === "green"
      ? "green"
      : phase.signals.N === "yellow" || phase.signals.E === "yellow"
        ? "yellow"
        : "allred";
    this.store.phase = {
      label: state === "allred" ? "Todo en rojo" : nsActive ? "Norte–Sur" : "Este–Oeste",
      state,
      endsAtMs: performance.now() + Math.max(0, phase.duration - this.phaseTime) * 1000,
      timeScale: 1,
      totalSim: phase.duration,
    };
  }
}
