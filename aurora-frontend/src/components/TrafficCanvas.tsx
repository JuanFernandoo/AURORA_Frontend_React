import { useEffect, useRef } from "react";
import { WORLD } from "../viz/geometry";
import {
  SpriteCache,
  createStaticLayer,
  drawMetricsPanel,
  drawQueueBadges,
  drawSignalHeads,
  drawStopLines,
  drawVehicles,
} from "../viz/renderer";
import type { SceneStore } from "../viz/SceneStore";

/**
 * Visualizador cenital de la interseccion (Canvas 2D).
 *
 * Rendimiento:
 *  - El escenario (calles, manzanas, cebras) se dibuja UNA vez en un canvas
 *    fuera de pantalla y cada frame solo se copia con drawImage.
 *  - Los autos son sprites pre-renderizados; cada frame hace un drawImage por
 *    auto con una unica matriz de transformacion (sin save/restore).
 *  - El bucle requestAnimationFrame NO pasa por React: lee el SceneStore
 *    directamente, asi que 60 fps no provocan re-renders. Si no hay datos
 *    nuevos y la interpolacion ya termino, se omite el redibujado.
 *  - Soporta pantallas HiDPI (devicePixelRatio) y redimensionado.
 */
export function TrafficCanvas({ store, label }: { store: SceneStore; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const sprites = new SpriteCache();
    let staticLayer: HTMLCanvasElement | null = null;
    let scale = 1;
    let frameId = 0;
    let lastVersion = -1;
    let lastAlpha = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const size = Math.max(240, Math.round(canvas.getBoundingClientRect().width * dpr));
      if (canvas.width === size && staticLayer) return;
      canvas.width = size;
      canvas.height = size;
      scale = size / WORLD;
      staticLayer = createStaticLayer(size, scale);
      sprites.reset();
      lastVersion = -1;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);
      if (!staticLayer) return;

      const alpha = store.alphaAt(now);
      if (store.version === lastVersion && lastAlpha >= 1 && alpha >= 1) return;
      lastVersion = store.version;
      lastAlpha = alpha;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticLayer, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawStopLines(ctx, store.signals);
      drawVehicles(ctx, store.pairs, alpha, sprites, scale);
      drawSignalHeads(ctx, store.signals);
      drawQueueBadges(ctx, store.queues, store.signals);
      drawMetricsPanel(ctx, store.metrics, store.queues);
    };
    frameId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [store]);

  return <canvas ref={canvasRef} className="twin-canvas" role="img" aria-label={label} />;
}
