import {
  BOX_MAX,
  BOX_MIN,
  CAR_LEN,
  CAR_WID,
  CENTER,
  CROSSWALK_FROM,
  CROSSWALK_TO,
  ROAD_HALF,
  STOP_FRONT,
  WORLD,
} from "./geometry";
import type { VehiclePair } from "./SceneStore";
import type { Approach, MetricsInfo, SignalColor, SignalMap } from "./types";

/** Paleta clara y silenciosa: el color queda reservado a semaforos y vehiculos. */
const COLORS = {
  bg: "#F4F5F7",
  block: "#FFFFFF",
  blockStroke: "#E6E8EC",
  road: "#E4E7EC",
  box: "#DDE1E7",
  curb: "#CDD2DA",
  dash: "rgba(255, 255, 255, 0.95)",
  zebra: "rgba(255, 255, 255, 0.9)",
} as const;

const SIGNAL_ON: Record<SignalColor, string> = {
  red: "#E5484D",
  yellow: "#F2B01E",
  green: "#2FA866",
};

const SIGNAL_OFF: Record<SignalColor, string> = {
  red: "#4A2A2D",
  yellow: "#4A3F22",
  green: "#21402F",
};

/** 0 = Norte-Sur (grafito), 1 = Este-Oeste (gris azulado). Evitan rojo/amarillo/verde, que son de los semaforos. */
const CAR_BODIES = ["#1B2430", "#8B96A8"];
/** Los sprites se pintan a mayor resolucion que la pantalla: al rotar y trasladar, el reescalado sale nitido. */
const SPRITE_SUPERSAMPLE = 2;

/* ------------------------------------------------------------------ */
/* Capa estatica: se dibuja UNA vez (y al redimensionar), no por frame. */
/* ------------------------------------------------------------------ */

export function createStaticLayer(sizePx: number, scale: number): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = sizePx;
  layer.height = sizePx;
  const ctx = layer.getContext("2d");
  if (!ctx) return layer;
  ctx.scale(scale, scale);

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WORLD, WORLD);

  // Cuatro manzanas en las esquinas.
  const margin = 10;
  const blockSize = BOX_MIN - 2 * margin;
  for (const bx of [margin, BOX_MAX + margin]) {
    for (const by of [margin, BOX_MAX + margin]) {
      ctx.fillStyle = COLORS.block;
      ctx.strokeStyle = COLORS.blockStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, blockSize, blockSize, 8);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Calzadas.
  ctx.fillStyle = COLORS.road;
  ctx.fillRect(0, BOX_MIN, WORLD, 2 * ROAD_HALF);
  ctx.fillRect(BOX_MIN, 0, 2 * ROAD_HALF, WORLD);
  ctx.fillStyle = COLORS.box;
  ctx.fillRect(BOX_MIN, BOX_MIN, 2 * ROAD_HALF, 2 * ROAD_HALF);

  // Bordillos (solo fuera de la interseccion).
  ctx.strokeStyle = COLORS.curb;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const x of [BOX_MIN, BOX_MAX]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, BOX_MIN);
    ctx.moveTo(x, BOX_MAX);
    ctx.lineTo(x, WORLD);
  }
  for (const y of [BOX_MIN, BOX_MAX]) {
    ctx.moveTo(0, y);
    ctx.lineTo(BOX_MIN, y);
    ctx.moveTo(BOX_MAX, y);
    ctx.lineTo(WORLD, y);
  }
  ctx.stroke();

  // Lineas divisorias centrales (discontinuas, claras).
  ctx.strokeStyle = COLORS.dash;
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 14]);
  ctx.beginPath();
  const dashEnd = CROSSWALK_FROM - 10;
  ctx.moveTo(CENTER, 0);
  ctx.lineTo(CENTER, dashEnd);
  ctx.moveTo(CENTER, WORLD - dashEnd);
  ctx.lineTo(CENTER, WORLD);
  ctx.moveTo(0, CENTER);
  ctx.lineTo(dashEnd, CENTER);
  ctx.moveTo(WORLD - dashEnd, CENTER);
  ctx.lineTo(WORLD, CENTER);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cruces peatonales (cebra) en los cuatro accesos.
  ctx.fillStyle = COLORS.zebra;
  const band = CROSSWALK_TO - CROSSWALK_FROM;
  for (let p = BOX_MIN + 4; p < BOX_MAX - 4; p += 12) {
    ctx.fillRect(p, CROSSWALK_FROM, 7, band);
    ctx.fillRect(p, WORLD - CROSSWALK_TO, 7, band);
    ctx.fillRect(CROSSWALK_FROM, p, band, 7);
    ctx.fillRect(WORLD - CROSSWALK_TO, p, band, 7);
  }

  return layer;
}

/* ------------------------------------------------------------------ */
/* Capa dinamica: lineas de pare y cabezales de semaforo (4 por frame). */
/* ------------------------------------------------------------------ */

/** La linea de pare toma el color del semaforo de su acceso. */
export function drawStopLines(ctx: CanvasRenderingContext2D, signals: SignalMap): void {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = SIGNAL_ON[signals.N];
  ctx.fillRect(BOX_MIN, STOP_FRONT + 2, ROAD_HALF, 4);
  ctx.fillStyle = SIGNAL_ON[signals.S];
  ctx.fillRect(CENTER, WORLD - STOP_FRONT - 6, ROAD_HALF, 4);
  ctx.fillStyle = SIGNAL_ON[signals.W];
  ctx.fillRect(STOP_FRONT + 2, CENTER, 4, ROAD_HALF);
  ctx.fillStyle = SIGNAL_ON[signals.E];
  ctx.fillRect(WORLD - STOP_FRONT - 6, BOX_MIN, 4, ROAD_HALF);
  ctx.globalAlpha = 1;
}

const BADGES: Record<Approach, { x: number; y: number; name: string }> = {
  N: { x: 275, y: 210, name: "NORTE" },
  S: { x: 525, y: 590, name: "SUR" },
  W: { x: 210, y: 525, name: "OESTE" },
  E: { x: 590, y: 275, name: "ESTE" },
};

const FONT = '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** Contador de vehiculos en espera por acceso, sobre las manzanas (espacio que antes estaba vacio). */
export function drawQueueBadges(
  ctx: CanvasRenderingContext2D,
  queues: Record<Approach, number>,
  signals: SignalMap,
): void {
  const w = 96;
  const h = 62;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const approach of ["N", "S", "E", "W"] as const) {
    const b = BADGES[approach];
    ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
    ctx.strokeStyle = SIGNAL_ON[signals[approach]];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2, b.y - h / 2, w, h, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#667085";
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(b.name, b.x, b.y - 11);
    ctx.fillStyle = "#111418";
    ctx.font = `600 32px ${FONT}`;
    ctx.fillText(String(queues[approach]), b.x, b.y + 22);
  }
}

/**
 * Panel de metricas en la manzana superior izquierda (zona que no usa ningun otro elemento).
 * Con backend: ciclo, espera acumulada y vehiculos cruzados salen de los ciclos ya cerrados de la
 * respuesta; "Cola total" es la suma de los contadores dibujados. En DEMO no hay metricas reales.
 */
export function drawMetricsPanel(
  _ctx: CanvasRenderingContext2D,
  _metrics: MetricsInfo | null,
  _queues: Record<Approach, number>,
): void {
  // Las metricas (ciclo, espera, vehiculos que cruzan) se muestran fuera del lienzo, en la pagina.
}

interface Head {
  x: number;
  y: number;
  vertical: boolean;
  /** true si el sentido de marcha es hacia coordenadas decrecientes. */
  reversed: boolean;
}

/** Un cabezal por esquina, junto a la linea de pare del acceso que regula. */
const HEADS: Record<Approach, Head> = {
  N: { x: 324, y: 298, vertical: true, reversed: false },
  S: { x: 476, y: 502, vertical: true, reversed: true },
  W: { x: 298, y: 476, vertical: false, reversed: false },
  E: { x: 502, y: 324, vertical: false, reversed: true },
};

const LAMPS: readonly SignalColor[] = ["red", "yellow", "green"];

export function drawSignalHeads(ctx: CanvasRenderingContext2D, signals: SignalMap): void {
  for (const approach of ["N", "S", "E", "W"] as const) {
    const head = HEADS[approach];
    const lit = signals[approach];
    const w = head.vertical ? 24 : 66;
    const h = head.vertical ? 66 : 24;

    ctx.fillStyle = "#1B2028";
    ctx.strokeStyle = "#2D3540";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(head.x - w / 2, head.y - h / 2, w, h, 7);
    ctx.fill();
    ctx.stroke();

    const offsets = head.reversed ? [21, 0, -21] : [-21, 0, 21];
    for (let i = 0; i < LAMPS.length; i++) {
      const lamp = LAMPS[i];
      const cx = head.vertical ? head.x : head.x + offsets[i];
      const cy = head.vertical ? head.y + offsets[i] : head.y;
      if (lamp === lit) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = SIGNAL_ON[lamp];
        ctx.beginPath();
        ctx.arc(cx, cy, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = lamp === lit ? SIGNAL_ON[lamp] : SIGNAL_OFF[lamp];
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------------ */
/* Vehiculos: sprites pre-renderizados + drawImage con matriz de rotacion. */
/* ------------------------------------------------------------------ */

const SPRITE_W = CAR_LEN + 8;
const SPRITE_H = CAR_WID + 8;

function paintCar(ctx: CanvasRenderingContext2D, body: string, braking: boolean): void {
  const L = CAR_LEN;
  const W = CAR_WID;
  const hl = L / 2;
  const hw = W / 2;

  // Sombra.
  ctx.fillStyle = "rgba(17, 20, 24, 0.14)";
  ctx.beginPath();
  ctx.roundRect(-hl + 1.5, -hw + 2, L, W, 5);
  ctx.fill();

  // Resplandor de freno.
  if (braking) {
    ctx.fillStyle = "rgba(229, 72, 77, 0.22)";
    ctx.fillRect(-hl - 5, -hw + 1, 6, W - 2);
  }

  // Carroceria (el vehiculo apunta hacia +x).
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, L, W, 5);
  ctx.fill();

  // Cabina: vidrios oscuros y techo.
  ctx.fillStyle = "rgba(10, 14, 20, 0.55)";
  ctx.beginPath();
  ctx.roundRect(-0.23 * L, -0.38 * W, 0.54 * L, 0.76 * W, 4);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-0.17 * L, -0.28 * W, 0.34 * L, 0.56 * W, 3);
  ctx.fill();

  // Faros delanteros y luces traseras.
  const lampH = 0.22 * W;
  ctx.fillStyle = "#fff6c8";
  ctx.fillRect(hl - 2.5, -hw + 1.5, 2.5, lampH);
  ctx.fillRect(hl - 2.5, hw - 1.5 - lampH, 2.5, lampH);
  ctx.fillStyle = braking ? "#E5484D" : "#8A5A5C";
  ctx.fillRect(-hl, -hw + 1.5, 2.5, lampH);
  ctx.fillRect(-hl, hw - 1.5 - lampH, 2.5, lampH);
}

export class SpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();

  reset(): void {
    this.cache.clear();
  }

  get(color: number, braking: boolean, scale: number): HTMLCanvasElement {
    const key = `${color}|${braking ? 1 : 0}`;
    let sprite = this.cache.get(key);
    if (!sprite) {
      sprite = document.createElement("canvas");
      const k = scale * SPRITE_SUPERSAMPLE;
      sprite.width = Math.ceil(SPRITE_W * k);
      sprite.height = Math.ceil(SPRITE_H * k);
      const sctx = sprite.getContext("2d");
      if (sctx) {
        sctx.scale(k, k);
        sctx.translate(SPRITE_W / 2, SPRITE_H / 2);
        paintCar(sctx, CAR_BODIES[color % CAR_BODIES.length], braking);
      }
      this.cache.set(key, sprite);
    }
    return sprite;
  }
}

function lerpAngle(from: number, to: number, alpha: number): number {
  let delta = to - from;
  delta = ((((delta + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return from + delta * alpha;
}

/**
 * Dibuja todos los vehiculos interpolados entre su pose anterior y la
 * actual. Usa una unica matriz de transformacion por vehiculo (sin
 * save/restore) y descarta los que estan fuera del mundo visible.
 */
export function drawVehicles(
  ctx: CanvasRenderingContext2D,
  pairs: readonly VehiclePair[],
  alpha: number,
  sprites: SpriteCache,
  scale: number,
): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (const p of pairs) {
    const x = p.x0 + (p.x1 - p.x0) * alpha;
    const y = p.y0 + (p.y1 - p.y0) * alpha;
    if (x < -40 || x > WORLD + 40 || y < -40 || y > WORLD + 40) continue;
    const angle = lerpAngle(p.a0, p.a1, alpha);
    const cos = Math.cos(angle) * scale;
    const sin = Math.sin(angle) * scale;
    const sprite = sprites.get(p.color, p.braking, scale);
    // Un auto detenido se alinea a pixeles enteros (borde nitido); uno en movimiento conserva el subpixel.
    const parado = p.x0 === p.x1 && p.y0 === p.y1;
    const tx = parado ? Math.round(x * scale) : x * scale;
    const ty = parado ? Math.round(y * scale) : y * scale;
    ctx.setTransform(cos, sin, -sin, cos, tx, ty);
    ctx.drawImage(sprite, -SPRITE_W / 2, -SPRITE_H / 2, SPRITE_W, SPRITE_H);
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
