import type { Approach } from "./types";

/** Mundo logico cuadrado de 800x800 unidades; el canvas lo escala a pixeles. */
export const WORLD = 800;
export const CENTER = WORLD / 2;

/** Cada calle mide 120 unidades de ancho: un carril por sentido (60 c/u). */
export const ROAD_HALF = 60;
export const BOX_MIN = CENTER - ROAD_HALF; // 340
export const BOX_MAX = CENTER + ROAD_HALF; // 460

/** Distancia del eje de la calle al centro de cada carril (transito por la derecha). */
export const LANE_OFFSET = 30;

export const CAR_LEN = 36;
export const CAR_WID = 19;
/** Distancia centro a centro entre dos vehiculos en cola. */
export const SPACING = 44;

/** Coordenada "s" (distancia desde el borde del mundo) del parachoques delantero en la linea de pare. */
export const STOP_FRONT = 306;
/** Centro del primer vehiculo de la cola. */
export const SLOT0 = STOP_FRONT - CAR_LEN / 2;

export const CROSSWALK_FROM = 318;
export const CROSSWALK_TO = 336;

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

/**
 * Convierte "s" (distancia recorrida desde el borde del mundo por el carril
 * de un acceso) a coordenadas X/Y y angulo. Transito por la derecha:
 *  - N: llega desde el norte, va hacia el sur, carril oeste (x = 370).
 *  - S: llega desde el sur, va hacia el norte, carril este (x = 430).
 *  - W: llega desde el oeste, va hacia el este, carril sur (y = 430).
 *  - E: llega desde el este, va hacia el oeste, carril norte (y = 370).
 */
export function poseOf(approach: Approach, s: number): Pose {
  switch (approach) {
    case "N":
      return { x: CENTER - LANE_OFFSET, y: s, angle: Math.PI / 2 };
    case "S":
      return { x: CENTER + LANE_OFFSET, y: WORLD - s, angle: -Math.PI / 2 };
    case "W":
      return { x: s, y: CENTER + LANE_OFFSET, angle: 0 };
    case "E":
      return { x: WORLD - s, y: CENTER - LANE_OFFSET, angle: Math.PI };
  }
}
