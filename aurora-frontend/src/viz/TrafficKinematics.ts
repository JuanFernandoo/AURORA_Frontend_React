import { SLOT0, SPACING, WORLD, poseOf } from "./geometry";
import type { Approach, SceneSnapshot, SignalMap, VehicleState } from "./types";
import { APPROACHES, allRed } from "./types";

/** Velocidades en unidades de mundo por segundo de REPRODUCCION (no de simulacion). */
const APPROACH_SPEED = 170;
const CROSS_MAX_SPEED = 340;
const CROSS_ACCEL = 700;

interface Vehicle {
  id: number;
  approach: Approach;
  /** Distancia desde el borde del mundo por el carril del acceso (centro del vehiculo). */
  s: number;
  v: number;
  color: number;
}

/**
 * Cinematica VISUAL minima: ordena los vehiculos de cada acceso en una cola,
 * los hace avanzar hasta su puesto, y permite "liberar" al primero para que
 * cruce la interseccion. NO decide cuando liberar ni cuantos vehiculos
 * llegan: eso lo dicta la fuente (backendPlayback.ts con los datos reales del
 * backend, o demoFeed.ts con datos sinteticos).
 */
export class TrafficKinematics {
  signals: SignalMap = allRed();

  private nextId = 1;
  private queued: Record<Approach, Vehicle[]> = { N: [], S: [], E: [], W: [] };
  private lastReleased: Record<Approach, Vehicle | null> = { N: null, S: null, E: null, W: null };
  private crossing: Vehicle[] = [];

  queueLength(approach: Approach): number {
    return this.queued[approach].length;
  }

  /** Coloca un vehiculo directamente en su puesto de la cola (estado inicial). */
  spawnQueued(approach: Approach): void {
    const list = this.queued[approach];
    list.push(this.create(approach, SLOT0 - list.length * SPACING));
  }

  /** Crea un vehiculo fuera de la pantalla que avanza hacia el final de la cola. */
  spawnArriving(approach: Approach): void {
    const list = this.queued[approach];
    const last = list.length > 0 ? list[list.length - 1] : null;
    const s = last ? Math.min(-20, last.s - SPACING) : -20;
    list.push(this.create(approach, s));
  }

  /** El primer vehiculo de la cola empieza a cruzar. Devuelve false si la cola esta vacia. */
  release(approach: Approach): boolean {
    const vehicle = this.queued[approach].shift();
    if (!vehicle) return false;
    vehicle.v = 0;
    this.crossing.push(vehicle);
    this.lastReleased[approach] = vehicle;
    return true;
  }

  step(dt: number): void {
    for (const approach of APPROACHES) {
      const list = this.queued[approach];
      for (let i = 0; i < list.length; i++) {
        const vehicle = list[i];
        let limit = SLOT0 - i * SPACING;
        if (i > 0) {
          limit = Math.min(limit, list[i - 1].s - SPACING);
        } else {
          const ahead = this.lastReleased[approach];
          if (ahead) limit = Math.min(limit, ahead.s - SPACING);
        }
        vehicle.s = Math.min(limit, vehicle.s + APPROACH_SPEED * dt);
      }
    }

    for (const vehicle of this.crossing) {
      vehicle.v = Math.min(CROSS_MAX_SPEED, vehicle.v + CROSS_ACCEL * dt);
      vehicle.s += vehicle.v * dt;
    }
    this.crossing = this.crossing.filter((vehicle) => vehicle.s < WORLD + 40);
  }

  snapshot(): SceneSnapshot {
    const vehicles: VehicleState[] = [];
    const push = (vehicle: Vehicle) => {
      const pose = poseOf(vehicle.approach, vehicle.s);
      vehicles.push({ id: vehicle.id, x: pose.x, y: pose.y, angle: pose.angle, color: vehicle.color });
    };
    for (const approach of APPROACHES) this.queued[approach].forEach(push);
    this.crossing.forEach(push);
    const queues = {
      N: this.queued.N.length,
      S: this.queued.S.length,
      E: this.queued.E.length,
      W: this.queued.W.length,
    };
    return { vehicles, signals: { ...this.signals }, queues };
  }

  private create(approach: Approach, s: number): Vehicle {
    const id = this.nextId++;
    return { id, approach, s, v: 0, color: approach === "N" || approach === "S" ? 0 : 1 };
  }
}
