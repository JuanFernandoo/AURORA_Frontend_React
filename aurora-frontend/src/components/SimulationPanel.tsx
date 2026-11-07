import { useEffect, useState } from "react";
import { ApiError, auroraApi } from "../services/apiClient";
import { DEMO_CONTROLADORES, obtenerMuestraDemoSimulacion } from "../services/demoFixtures";
import type { FuenteDatos, SimulacionResultado, TipoControlador } from "../types/aurora";
import { CycleTable } from "./CycleTable";
import { MetricsSummary } from "./MetricsSummary";
import { SourceTag } from "./SourceTag";

/**
 * Ejecuta UNA estrategia. En modo conectado, selecciona el tipo de
 * controlador consultando primero los tipos reales que expone
 * GET /api/controladores (construidos por la Factory del backend), y al
 * presionar "Ejecutar" llama POST /api/simulaciones — el backend construye
 * el controlador (Factory), lo inyecta en MotorSemaforico (Strategy) y
 * registra un ObservadorMetricas (Observer) real. No hay simulación local.
 */
export function SimulationPanel({ modoDemo }: { modoDemo: boolean }) {
  const [tiposDisponibles, setTiposDisponibles] = useState<TipoControlador[]>(DEMO_CONTROLADORES.tipos);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoControlador>("ADAPTATIVO");
  const [numeroCiclos, setNumeroCiclos] = useState<number>(15);
  const [resultado, setResultado] = useState<SimulacionResultado | null>(null);
  const [fuente, setFuente] = useState<FuenteDatos>("demo");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Carga los tipos de controlador reales (o la muestra DEMO) al cambiar de modo.
  useEffect(() => {
    if (modoDemo) {
      setTiposDisponibles(DEMO_CONTROLADORES.tipos);
      return;
    }
    auroraApi
      .obtenerControladoresDisponibles()
      .then((respuesta) => setTiposDisponibles(respuesta.tipos))
      .catch(() => setTiposDisponibles(DEMO_CONTROLADORES.tipos));
  }, [modoDemo]);

  function ejecutar() {
    setCargando(true);
    setError(null);

    if (modoDemo) {
      // Muestra DEMO: dato congelado real, NO una ejecución en vivo. Se
      // simula una pequeña latencia para que la interfaz sea honesta sobre
      // que esto no es instantáneo tampoco en modo conectado.
      window.setTimeout(() => {
        setResultado(obtenerMuestraDemoSimulacion(tipoSeleccionado));
        setFuente("demo");
        setCargando(false);
      }, 300);
      return;
    }

    auroraApi
      .ejecutarSimulacion(tipoSeleccionado, numeroCiclos)
      .then((respuesta) => {
        setResultado(respuesta);
        setFuente("live");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Error desconocido al ejecutar la simulación");
        setResultado(obtenerMuestraDemoSimulacion(tipoSeleccionado));
        setFuente("demo");
      })
      .finally(() => setCargando(false));
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Ejecutar una estrategia</h2>
      </header>

      <div className="form-row">
        <fieldset className="controller-select">
          <legend>Controlador (POST /api/simulaciones)</legend>
          {tiposDisponibles.map((tipo) => (
            <label key={tipo} className="controller-select__opcion">
              <input
                type="radio"
                name="tipoControlador"
                value={tipo}
                checked={tipoSeleccionado === tipo}
                onChange={() => setTipoSeleccionado(tipo)}
              />
              {tipo === "CICLO_FIJO" ? "Ciclo Fijo" : "Adaptativo (heurística)"}
            </label>
          ))}
        </fieldset>

        <label className="numero-ciclos">
          Número de ciclos
          <input
            type="number"
            min={1}
            max={100}
            value={numeroCiclos}
            onChange={(e) => setNumeroCiclos(Number(e.target.value) || 1)}
            disabled={modoDemo}
          />
        </label>

        <button type="button" onClick={ejecutar} disabled={cargando} className="boton-primario">
          {cargando ? "Ejecutando…" : "Ejecutar simulación"}
        </button>
      </div>

      {modoDemo && (
        <p className="aviso-demo">
          Modo DEMO activo: el número de ciclos se ignora y se muestra una ejecución de muestra ya
          capturada del backend real.
        </p>
      )}
      {error && <p className="panel__error">{error} — mostrando muestra DEMO en su lugar.</p>}

      {resultado && (
        <div className="resultado">
          <div className="resultado__encabezado">
            <h3>{resultado.nombreEstrategia}</h3>
            <SourceTag fuente={fuente} />
          </div>
          <p className="resultado__estado-inicial">
            Estado inicial: Norte-Sur = {resultado.estadoInicial.vehiculosEsperaNorteSur}, Este-Oeste ={" "}
            {resultado.estadoInicial.vehiculosEsperaEsteOeste}
          </p>
          <MetricsSummary metricas={resultado.metricas} />
          <CycleTable ciclos={resultado.ciclos} />
        </div>
      )}
    </section>
  );
}
