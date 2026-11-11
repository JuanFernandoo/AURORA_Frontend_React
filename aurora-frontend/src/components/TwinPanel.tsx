import { useEffect, useRef, useState } from "react";
import { ApiError, auroraApi } from "../services/apiClient";
import type { CompararResultado, SimulacionResultado, TipoControlador } from "../types/aurora";
import { lideDeComparacion } from "../services/comparacion";
import type { ProgresoComparacion } from "../services/comparacion";
import { ComparisonMarker } from "./ComparisonMarker";
import { GraficoEspera } from "./GraficoEspera";
import { TwinView } from "./TwinView";

type Modo = "una" | "comparar";
type Fuente = "backend" | "demo";

interface Escena {
  clave: number;
  una?: SimulacionResultado;
  comparacion?: CompararResultado;
}

interface Opcion<T extends string> {
  valor: T;
  etiqueta: string;
  deshabilitada?: boolean;
}

const OPCIONES_MODO: Opcion<Modo>[] = [
  { valor: "una", etiqueta: "Una estrategia" },
  { valor: "comparar", etiqueta: "Comparar" },
];

const OPCIONES_TIPO: Opcion<TipoControlador>[] = [
  { valor: "CICLO_FIJO", etiqueta: "Ciclo fijo" },
  { valor: "ADAPTATIVO", etiqueta: "Adaptativo" },
];

/** Selector de una opción entre pocas: radios nativos (teclado y lectores de pantalla) con aspecto de texto. */
function Segmentado<T extends string>({
  nombre,
  grupo,
  valor,
  opciones,
  onCambio,
}: {
  nombre: string;
  grupo: string;
  valor: T;
  opciones: Opcion<T>[];
  onCambio: (valor: T) => void;
}) {
  return (
    <fieldset className="segmentado">
      <legend className="sr-only">{nombre}</legend>
      {opciones.map((o) => (
        <label key={o.valor} className="segmentado__op">
          <input
            type="radio"
            name={grupo}
            checked={valor === o.valor}
            disabled={o.deshabilitada}
            onChange={() => onCambio(o.valor)}
          />
          {o.etiqueta}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Gemelo digital: vista cenital animada de la intersección.
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
  const opcionesFuente: Opcion<Fuente>[] = [
    { valor: "backend", etiqueta: "Backend", deshabilitada: modoDemo },
    { valor: "demo", etiqueta: "Demo" },
  ];

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
      <div className="form-row">
        <Segmentado nombre="Fuente de datos" grupo="fuente" valor={fuente} opciones={opcionesFuente} onCambio={(valor) => setFuenteElegida(valor as Fuente)} />

        {fuente === "backend" && (
          <>
            <Segmentado nombre="Vista" grupo="modo" valor={modo} opciones={OPCIONES_MODO} onCambio={(valor) => setModo(valor as Modo)} />
            {modo === "una" && (
              <Segmentado nombre="Controlador" grupo="tipo" valor={tipo} opciones={OPCIONES_TIPO} onCambio={(valor) => setTipo(valor as TipoControlador)} />
            )}
            <label className="campo">
              Ciclos
              <input
                type="number"
                min={1}
                max={100}
                value={numeroCiclos}
                onChange={(e) => setNumeroCiclos(Number(e.target.value) || 1)}
              />
            </label>
            <label className="campo">
              Velocidad
              <select value={timeScale} onChange={(e) => setTimeScale(Number(e.target.value))}>
                <option value={2}>×2</option>
                <option value={4}>×4</option>
                <option value={6}>×6</option>
              </select>
            </label>
          </>
        )}

        <button
          type="button"
          className="boton-primario form-row__accion"
          onClick={ejecutar}
          disabled={cargando || (conectando && fuente === "backend")}
        >
          {cargando
            ? "Ejecutando…"
            : conectando && fuente === "backend"
              ? "Conectando…"
              : fuente === "demo"
                ? "Reiniciar demo"
                : "Ejecutar"}
        </button>
      </div>

      {modoDemo && <p className="aviso-demo">Backend no disponible o demo forzado: se muestra un flujo sintético, no una ejecución real.</p>}
      {error && <p className="panel__error">{error}. Elige la fuente Demo para ver la escena sin backend.</p>}

      <details className="guia">
        <summary>Cómo leer la escena</summary>
        <p>
          Es una intersección vista desde arriba. Cada número es la cantidad de vehículos que esperan en ese
          acceso y una luz trasera roja marca un auto detenido. El ciclo fijo alterna cada 15 s sin mirar la cola; el
          adaptativo da más verde a la calle con más autos. Gana quien acumula menos espera, medida en
          vehículo-segundos (veh·s): autos esperando por segundos de espera.
        </p>
      </details>

      <div className="twin-escena" ref={escenaRef}>
        {fuente === "demo" && (
          <TwinView key={`demo-${demoClave}`} titulo="Flujo sintético" fuente="demo" resultado={null} timeScale={timeScale} />
        )}

        {fuente === "backend" && !escena && !cargando && (
          <p className="panel__estado">
            Pulsa Ejecutar: el backend calcula la simulación y aquí se anima ciclo a ciclo. Para ver la diferencia entre los dos
            semáforos, elige Comparar.
          </p>
        )}

        {fuente === "backend" && escena?.una && (
          <TwinView
            key={escena.clave}
            titulo={escena.una.nombreEstrategia}
            fuente="backend"
            resultado={escena.una}
            timeScale={timeScale}
          />
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
          </>
        )}
      </div>
    </section>
  );
}
