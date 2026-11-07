import { useEffect, useRef, useState } from "react";
import type { CicloDto, SimulacionResultado } from "../types/aurora";
import { BackendPlayback } from "../viz/backendPlayback";
import type { DibujadoEnCola } from "../viz/backendPlayback";
import { DemoFeed } from "../viz/demoFeed";
import { SceneStore } from "../viz/SceneStore";
import { SourceTag } from "./SourceTag";
import { PhaseBar } from "./PhaseBar";
import { TrafficCanvas } from "./TrafficCanvas";

interface Props {
  titulo: string;
  fuente: "backend" | "demo";
  /** Respuesta real de POST /api/simulaciones (solo para fuente "backend"). */
  resultado: SimulacionResultado | null;
  /** Segundos simulados por segundo de reproduccion. */
  timeScale: number;
  /** Ciclos ya completados en la reproduccion (0 al arrancar o repetir). Lo usa el marcador de comparacion. */
  onProgreso?: (ciclosCompletados: number) => void;
  /** true si esta vista tiene menos espera acumulada en la comparacion (resalta el encabezado y el borde). */
  lider?: boolean;
}

interface CicloEnCurso {
  indice: number;
  total: number;
  ciclo: CicloDto;
}

interface Verificacion {
  indice: number;
  ciclo: CicloDto;
  dibujado: DibujadoEnCola;
}

/**
 * Un gemelo digital: canvas + panel de estado. En modo "backend" reproduce
 * una respuesta real del backend Java; en modo "demo" muestra un flujo
 * sintetico (etiquetado como DEMO).
 */
export function TwinView({ titulo, fuente, resultado, timeScale, onProgreso, lider = false }: Props) {
  const progresoRef = useRef(onProgreso);
  useEffect(() => {
    progresoRef.current = onProgreso;
  });
  const [store] = useState(() => new SceneStore());
  const [actual, setActual] = useState<CicloEnCurso | null>(null);
  const [verificado, setVerificado] = useState<Verificacion | null>(null);
  const [terminado, setTerminado] = useState(false);
  const [repeticion, setRepeticion] = useState(0);

  useEffect(() => {
    if (fuente === "demo") {
      const feed = new DemoFeed(store);
      feed.start();
      return () => feed.stop();
    }
    if (!resultado) return;
    const playback = new BackendPlayback(store, resultado, {
      timeScale,
      hooks: {
        onCycleStart: (indice, total, ciclo) => {
          if (indice === 0) progresoRef.current?.(0);
          setActual({ indice, total, ciclo });
          setTerminado(false);
        },
        onCycleEnd: (indice, _total, ciclo, dibujado) => {
          setVerificado({ indice, ciclo, dibujado });
          progresoRef.current?.(indice + 1);
        },
        onFinish: () => setTerminado(true),
      },
    });
    playback.start();
    return () => playback.stop();
  }, [store, fuente, resultado, timeScale, repeticion]);

  const coincide =
    verificado !== null &&
    verificado.dibujado.ns === verificado.ciclo.vehiculosEsperaNorteSur &&
    verificado.dibujado.eo === verificado.ciclo.vehiculosEsperaEsteOeste;

  return (
    <div className={lider ? "twin twin--lider" : "twin"}>
      <div className="twin__encabezado">
        <h3>{titulo}</h3>
        {lider && (
          <span className="twin__lider" title="Menor espera acumulada con el mismo numero de ciclos completos">
            ▲ Va mejor
          </span>
        )}
        <SourceTag fuente={fuente === "backend" ? "live" : "demo"} />
      </div>

      <PhaseBar store={store} />
      <TrafficCanvas store={store} label={`Vista cenital de la interseccion: ${titulo}`} />

      <div className="twin-leyenda" aria-label="Leyenda de colores">
        <span className="twin-leyenda__item twin-leyenda__item--ns">Norte–Sur</span>
        <span className="twin-leyenda__item twin-leyenda__item--eo">Este–Oeste</span>
        <span className="twin-leyenda__nota">Luz trasera roja = detenido</span>
      </div>

      <div className="twin-hud">
        {fuente === "demo" && (
          <p>
            Flujo sintetico (x, y, angulo y semaforo amarillo) generado en el navegador. No proviene del
            backend Java.
          </p>
        )}

        {fuente === "backend" && actual && (
          <>
            <p>
              <strong>
                Ciclo {actual.indice + 1}/{actual.total}
              </strong>{" "}
              · fase <code>{actual.ciclo.faseActiva}</code> · {actual.ciclo.duracionAccionSegundos} s
              simulados (x{timeScale}) · {actual.ciclo.vehiculosDescargados} vehiculos cruzan
            </p>
            <p>
              Espera acumulada (backend): {actual.ciclo.tiempoEsperaAcumuladoVehSeg.toFixed(1)} veh·s
            </p>
          </>
        )}

        {fuente === "backend" && verificado && (
          <p className={coincide ? "twin-hud__ok" : "twin-hud__alerta"}>
            Ciclo {verificado.indice + 1} · cola backend NS {verificado.ciclo.vehiculosEsperaNorteSur} / EO{" "}
            {verificado.ciclo.vehiculosEsperaEsteOeste} · cola dibujada NS {verificado.dibujado.ns} / EO{" "}
            {verificado.dibujado.eo} {coincide ? "✓ coincide" : "✗ NO coincide"}
          </p>
        )}

        {fuente === "backend" && terminado && (
          <p>
            Reproduccion finalizada.{" "}
            <button type="button" className="boton-secundario" onClick={() => setRepeticion((n) => n + 1)}>
              Repetir
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
