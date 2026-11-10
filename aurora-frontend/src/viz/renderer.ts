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

/** Paleta industrial oscura. */
const COLORS = {
  bg: "#0b0d10",
  block: "#13161b",
  blockStroke: "#1d2127",
  blockInner: "#171b20",
  road: "#23272d",
  box: "#272b32",
  curb: "#3b4149",
  dash: "rgba(210, 215, 222, 0.75)",
  zebra: "rgba(215, 220, 228, 0.5)",
} as const;

const SIGNAL_ON: Record<SignalColor, string> = {
  red: "#ff3b3b",
  yellow: "#ffc21a",
  green: "#2ee66b",
};

const SIGNAL_OFF: Record<SignalColor, string> = {
  red: "#3a1517",
  yellow: "#3a2f10",
  green: "#10321b",
};

/** 0 = Norte-Sur (azul), 1 = Este-Oeste (violeta). Evitan rojo/amarillo/verde, que son de los semaforos. */
const CAR_BODIES = ["#4aa3e8", "#b58cf2"];
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
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, blockSize, blockSize, 8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = COLORS.blockInner;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx + 14, by + 14, blockSize - 28, blockSize - 28, 4);
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

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** Contador de vehiculos en espera por acceso, sobre las manzanas (espacio que antes estaba vacio). */
export function drawQueueBadges(
  ctx: CanvasRenderingContext2D,
  queues: Record<Approach, number>,
  signals: SignalMap,
): void {
  const w = 124;
  const h = 76;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  for (const approach of ["N", "S", "E", "W"] as const) {
    const b = BADGES[approach];
    ctx.fillStyle = "rgba(10, 12, 15, 0.92)";
    ctx.strokeStyle = SIGNAL_ON[signals[approach]];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x - w / 2, b.y - h / 2, w, h, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#9aa4af";
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(b.name, b.x, b.y - 16);
    ctx.fillStyle = "#f2f5f8";
    ctx.font = `800 38px ${FONT}`;
    ctx.fillText(String(queues[approach]), b.x, b.y + 15);
    ctx.fillStyle = "#7d8791";
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText("en espera", b.x, b.y + 31);
  }
}

/**
 * Panel de metricas en la manzana superior izquierda (zona que no usa ningun otro elemento).
 * Con backend: ciclo, espera acumulada y vehiculos cruzados salen de los ciclos ya cerrados de la
 * respuesta; "Cola total" es la suma de los contadores dibujados. En DEMO no hay metricas reales.
 */
export function drawMetricsPanel(
  ctx: CanvasRenderingContext2D,
  metrics: MetricsInfo | null,
  queues: Record<Approach, number>,
): void {
  const x = 20;
  const y = 16;
  const w = 250;
  const rows: Array<[string, string]> = [];
  if (metrics) {
    rows.push(["Ciclo", `${metrics.ciclo}/${metrics.total}`]);
    rows.push(["Espera total", `${metrics.esperaAcum.toFixed(0)} veh·s`]);
    rows.push(["Cruzaron", String(metrics.cruzaron)]);
  }
  rows.push(["Cola total", String(queues.N + queues.S + queues.E + queues.W)]);
  const h = 38 + rows.length * 26;

  ctx.fillStyle = "rgba(10, 12, 15, 0.92)";
  ctx.strokeStyle = "#2a3038";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.fill();
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#7d8791";
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(metrics ? "MÉTRICAS DEL BACKEND" : "DEMO · SIN MÉTRICAS REALES", x + 12, y + 23);

  for (let i = 0; i < rows.length; i++) {
    const baseline = y + 48 + i * 26;
    ctx.textAlign = "left";
    ctx.fillStyle = "#9aa4af";
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(rows[i][0], x + 12, baseline);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f2f5f8";
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(rows[i][1], x + w - 12, baseline);
  }
  ctx.textAlign = "center";
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

    ctx.fillStyle = "#0a0c0f";
    ctx.strokeStyle = "#343a42";
    ctx.lineWidth = 1.5;
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
        ctx.globalAlpha = 0.28;
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
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.beginPath();
  ctx.roundRect(-hl + 1.5, -hw + 2, L, W, 5);
  ctx.fill();

  // Resplandor de freno.
  if (braking) {
    ctx.fillStyle = "rgba(255, 40, 40, 0.32)";
    ctx.fillRect(-hl - 5, -hw + 1, 6, W - 2);
  }

  // Carroceria (el vehiculo apunta hacia +x).
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, L, W, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, L, 5, 4);
  ctx.fill();

  // Cabina: vidrios oscuros y techo.
  ctx.fillStyle = "rgba(8, 11, 15, 0.9)";
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
  ctx.fillStyle = braking ? "#ff2a2a" : "#6e1a1a";
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
