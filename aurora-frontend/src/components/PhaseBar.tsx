import { useEffect, useRef } from "react";
import type { SceneStore } from "../viz/SceneStore";

const ESTADO_TEXTO = { green: "VERDE", yellow: "AMARILLO", allred: "", done: "" } as const;

/**
 * Indicador de fase: que direccion tiene paso y cuanto falta.
 * Se actualiza con su propio requestAnimationFrame escribiendo directo al DOM
 * (sin setState), asi la cuenta regresiva es fluida sin re-renderizar React.
 */
export function PhaseBar({ store }: { store: SceneStore }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const textoRef = useRef<HTMLSpanElement>(null);
  const tiempoRef = useRef<HTMLSpanElement>(null);
  const barraRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frameId = 0;
    const frame = (now: number) => {
      frameId = requestAnimationFrame(frame);
      const root = rootRef.current;
      const texto = textoRef.current;
      const tiempo = tiempoRef.current;
      const barra = barraRef.current;
      if (!root || !texto || !tiempo || !barra) return;

      const phase = store.phase;
      if (!phase) {
        root.dataset.estado = "espera";
        texto.textContent = "Esperando datos…";
        tiempo.textContent = "";
        barra.style.width = "0%";
        return;
      }
      root.dataset.estado = phase.state;
      if (phase.state === "done") {
        texto.textContent = "Reproducción finalizada";
        tiempo.textContent = "";
        barra.style.width = "0%";
        return;
      }
      const restanteSim = Math.max(0, ((phase.endsAtMs - now) / 1000) * phase.timeScale);
      const estado = ESTADO_TEXTO[phase.state];
      texto.textContent = estado ? `${phase.label} · ${estado}` : (phase.label ?? "");
      tiempo.textContent = `${Math.ceil(restanteSim)} s`;
      const fraccion = phase.totalSim > 0 ? Math.min(1, restanteSim / phase.totalSim) : 0;
      barra.style.width = `${(fraccion * 100).toFixed(1)}%`;
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [store]);

  return (
    <div className="phase-bar" ref={rootRef} data-estado="espera" role="status" aria-live="off">
      <div className="phase-bar__fila">
        <span className="phase-bar__punto" />
        <span className="phase-bar__texto" ref={textoRef}>
          Esperando datos…
        </span>
        <span className="phase-bar__tiempo" ref={tiempoRef} />
      </div>
      <div className="phase-bar__pista">
        <span className="phase-bar__relleno" ref={barraRef} />
      </div>
    </div>
  );
}
