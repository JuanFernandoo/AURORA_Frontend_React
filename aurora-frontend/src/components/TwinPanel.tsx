import { useEffect, useRef, useState } from "react";
import type { CompararResultado, SimulacionResultado, TipoControlador } from "../types/aurora";
import { lideDeComparacion } from "../services/comparacion";
import type { ProgresoComparacion } from "../services/comparacion";
import { ComparisonMarker } from "./ComparisonMarker";
import { GraficoEspera } from "./GraficoEspera";
import { TwinView } from "./TwinView";
import { ApiError, auroraApi } from "../services/apiClient";

type Modo = "una" | "comparar";
type Fuente = "backend" | "demo";

interface Escena {
  clave: number;
  una?: SimulacionResultado;
  comparacion?: CompararResultado;
}

/**
 * Gemelo digital: reemplaza las tablas por una vista cenital animada.
 * En modo conectado ejecuta la simulacion en el backend Java
 * (POST /api/simulaciones o /api/simulaciones/comparar) y reproduce la
 * respuesta real. En modo DEMO usa un flujo sintetico claramente etiquetado.
 */
export function TwinPanel({ modoDemo, conectando = false }: { modoDemo: boolean; conectando?: boolean }) {
  const [fuenteElegida, setFuenteElegida] = useState<Fuente>("backend");
  const [modo, setModo] = useState<Modo>("una");
  const [tipo, setTipo] = useState<TipoControlador>("ADAPTATIVO");
  const [numeroCiclos, setNumeroCiclos] = useState(15);
  const [timeScale, setTimeScale] = useState(4);
  const [escena, setEscena] = useState<Escena | null>(null);
  const [demoClave, setDemoClave] = useState(1);
  const [progreso, setProgreso] = useState<ProgresoComparacion>({ fijo: 0, adaptativo: 0 });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fuente: Fuente = modoDemo ? "demo" : fuenteElegida;

  // Al ejecutar, lleva la escena a la parte visible de la pantalla (no al cargar la pagina).
  const escenaRef = useRef<HTMLDivElement>(null);
  const claveEscena = escena?.clave ?? 0;
  useEffect(() => {
    if (claveEscena === 0 && demoClave === 1) return;
    escenaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [claveEscena, demoClave]);

  function ejecutar() {
    setError(null);
    if (fuente === "demo") {
      setDemoClave((n) => n + 1);
      return;
    }
    setCargando(true);
    setProgreso({ fijo: 0, adaptativo: 0 });
    const clave = Date.now();
    const peticion =
      modo === "una"
        ? auroraApi.ejecutarSimulacion(tipo, numeroCiclos).then((una): Escena => ({ clave, una }))
        : auroraApi.compararEstrategias(numeroCiclos).then((comparacion): Escena => ({ clave, comparacion }));
    peticion
      .then(setEscena)
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Error desconocido al ejecutar la simulacion"),
      )
      .finally(() => setCargando(false));
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Gemelo digital de la intersección</h2>
      </header>

      <details className="guia-lectura" open>
        <summary>¿Qué estoy viendo?</summary>
        <ul>
          <li>
            Una <strong>intersección vista desde arriba</strong> con dos calles que se cruzan. Los números dentro
            de los recuadros son los <strong>vehículos esperando</strong> en cada acceso.
          </li>
          <li>
            El <strong>ciclo fijo</strong> es el semáforo tradicional: alterna cada 15 s sin importar cuántos autos hay.
            El <strong>adaptativo</strong> da más tiempo de verde a la calle con más autos esperando.
          </li>
          <li>
            Al comparar, gana el que <strong>acumula menos espera</strong>. La espera se mide en vehículo-segundos
            (veh·s): cuántos autos esperan multiplicado por cuántos segundos.
          </li>
          <li>
            Es una <strong>simulación</strong> con tráfico sintético de una sola intersección; no son mediciones en una vía real.
          </li>
        </ul>
      </details>

      <div className="twin-layout">
      <div className="twin-controles">
      <div className="form-row">
        <fieldset className="controller-select">
          <legend>Fuente de datos</legend>
          <label className="controller-select__opcion">
            <input
              type="radio"
              name="fuente"
              checked={fuente === "backend"}
              disabled={modoDemo}
              onChange={() => setFuenteElegida("backend")}
            />
            Backend Java (real)
          </label>
          <label className="controller-select__opcion">
            <input
              type="radio"
              name="fuente"
              checked={fuente === "demo"}
              onChange={() => setFuenteElegida("demo")}
            />
            DEMO (flujo sintetico)
          </label>
        </fieldset>

        {fuente === "backend" && (
          <>
            <fieldset className="controller-select">
              <legend>Vista</legend>
              <label className="controller-select__opcion">
                <input type="radio" name="modo" checked={modo === "una"} onChange={() => setModo("una")} />
                Una estrategia
              </label>
              <label className="controller-select__opcion">
                <input
                  type="radio"
                  name="modo"
                  checked={modo === "comparar"}
                  onChange={() => setModo("comparar")}
                />
                Comparar lado a lado
              </label>
            </fieldset>

            {modo === "una" && (
              <fieldset className="controller-select">
                <legend>Controlador</legend>
                <label className="controller-select__opcion">
                  <input type="radio" name="tipo" checked={tipo === "CICLO_FIJO"} onChange={() => setTipo("CICLO_FIJO")} />
                  Ciclo Fijo
                </label>
                <label className="controller-select__opcion">
                  <input type="radio" name="tipo" checked={tipo === "ADAPTATIVO"} onChange={() => setTipo("ADAPTATIVO")} />
                  Adaptativo
                </label>
              </fieldset>
            )}

            <label className="numero-ciclos">
              Ciclos
              <input
                type="number"
                min={1}
                max={100}
                value={numeroCiclos}
                onChange={(e) => setNumeroCiclos(Number(e.target.value) || 1)}
              />
            </label>

            <label className="numero-ciclos">
              Velocidad
              <select value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))}>
                <option value={2}>x2</option>
                <option value={4}>x4</option>
                <option value={6}>x6</option>
              </select>
            </label>
          </>
        )}

        <button
          type="button"
          className="boton-primario"
          onClick={ejecutar}
          disabled={cargando || (conectando && fuente === "backend")}
        >
          {cargando
            ? "Ejecutando…"
            : conectando && fuente === "backend"
              ? "Conectando con el servidor…"
              : fuente === "demo"
                ? "Reiniciar DEMO"
                : "Ejecutar y reproducir"}
        </button>
      </div>

      {modoDemo && (
        <p className="aviso-demo">
          Backend no disponible (o modo DEMO forzado): se muestra el flujo sintetico, no una ejecucion real.
        </p>
      )}
      {error && (
        <p className="panel__error">
          {error} — elige la fuente DEMO para ver el visualizador sin backend.
        </p>
      )}

      </div>

      <div className="twin-escena" ref={escenaRef}>
      {fuente === "demo" && (
        <div className="twin-grid twin-grid--una">
          <TwinView key={`demo-${demoClave}`} titulo="Flujo sintetico" fuente="demo" resultado={null} timeScale={timeScale} />
        </div>
      )}

      {fuente === "backend" && !escena && !cargando && (
        <p className="panel__estado">
          Pulsa «Ejecutar y reproducir»: el backend calcula la simulación y aquí se anima ciclo a ciclo. Para ver la diferencia entre los dos semáforos, elige «Comparar lado a lado».
        </p>
      )}

      {fuente === "backend" && escena?.una && (
        <div className="twin-grid twin-grid--una">
          <TwinView
            key={escena.clave}
            titulo={escena.una.nombreEstrategia}
            fuente="backend"
            resultado={escena.una}
            timeScale={timeScale}
          />
        </div>
      )}

      {fuente === "backend" && escena?.comparacion && (
        <>
          <ComparisonMarker comparacion={escena.comparacion} progreso={progreso} />
          <div className="twin-grid">
            <TwinView
              key={`${escena.clave}-fijo`}
              titulo={escena.comparacion.cicloFijo.nombreEstrategia}
              fuente="backend"
              resultado={escena.comparacion.cicloFijo}
              timeScale={timeScale}
              onProgreso={(n) => setProgreso((p) => ({ ...p, fijo: n }))}
              lider={lideDeComparacion(escena.comparacion, progreso)?.lider === "fijo"}
            />
            <TwinView
              key={`${escena.clave}-adaptativo`}
              titulo={escena.comparacion.adaptativo.nombreEstrategia}
              fuente="backend"
              resultado={escena.comparacion.adaptativo}
              timeScale={timeScale}
              onProgreso={(n) => setProgreso((p) => ({ ...p, adaptativo: n }))}
              lider={lideDeComparacion(escena.comparacion, progreso)?.lider === "adaptativo"}
            />
          </div>
          <GraficoEspera comparacion={escena.comparacion} progreso={progreso} />
          <p className="comparacion-diferencia">
            {escena.comparacion.diferenciaCalculable
              ? `Diferencia porcentual de espera acumulada: ${escena.comparacion.diferenciaPorcentualEsperaAcumulada}% (calculada por el backend)`
              : "Diferencia porcentual no calculable para este escenario."}
          </p>
        </>
      )}
      </div>
      </div>
    </section>
  );
}
