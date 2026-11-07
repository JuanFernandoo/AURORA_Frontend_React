import { useState } from "react";
import { ApiError, auroraApi } from "../services/apiClient";
import { obtenerMuestraDemoComparacion } from "../services/demoFixtures";
import type { CompararResultado, FuenteDatos } from "../types/aurora";
import { MetricsSummary } from "./MetricsSummary";
import { SourceTag } from "./SourceTag";

/**
 * Ejecuta POST /api/simulaciones/comparar: el backend corre AMBAS
 * estrategias bajo las mismas condiciones iniciales y calcula la
 * diferencia porcentual real. El frontend NO recalcula ese porcentaje: lo
 * muestra tal como lo devuelve SimulacionApiService.comparar().
 */
export function ComparisonPanel({ modoDemo }: { modoDemo: boolean }) {
  const [numeroCiclos, setNumeroCiclos] = useState<number>(15);
  const [resultado, setResultado] = useState<CompararResultado | null>(null);
  const [fuente, setFuente] = useState<FuenteDatos>("demo");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function ejecutar() {
    setCargando(true);
    setError(null);

    if (modoDemo) {
      window.setTimeout(() => {
        setResultado(obtenerMuestraDemoComparacion());
        setFuente("demo");
        setCargando(false);
      }, 300);
      return;
    }

    auroraApi
      .compararEstrategias(numeroCiclos)
      .then((respuesta) => {
        setResultado(respuesta);
        setFuente("live");
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Error desconocido al comparar estrategias");
        setResultado(obtenerMuestraDemoComparacion());
        setFuente("demo");
      })
      .finally(() => setCargando(false));
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Comparar Ciclo Fijo vs. Adaptativo</h2>
      </header>

      <div className="form-row">
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
          {cargando ? "Comparando…" : "Comparar estrategias"}
        </button>
      </div>

      {modoDemo && (
        <p className="aviso-demo">
          Modo DEMO activo: se muestra una comparación de muestra ya capturada del backend real
          (no se ejecuta en vivo).
        </p>
      )}
      {error && <p className="panel__error">{error} — mostrando muestra DEMO en su lugar.</p>}

      {resultado && (
        <div className="resultado">
          <div className="resultado__encabezado">
            <h3>Resultado de la comparación</h3>
            <SourceTag fuente={fuente} />
          </div>

          <div className="comparacion-grid">
            <div>
              <h4>{resultado.cicloFijo.nombreEstrategia}</h4>
              <MetricsSummary metricas={resultado.cicloFijo.metricas} />
            </div>
            <div>
              <h4>{resultado.adaptativo.nombreEstrategia}</h4>
              <MetricsSummary metricas={resultado.adaptativo.metricas} />
            </div>
          </div>

          <p className="comparacion-diferencia">
            {resultado.diferenciaCalculable
              ? `Diferencia porcentual de espera acumulada: ${resultado.diferenciaPorcentualEsperaAcumulada}% (calculada por el backend)`
              : "Diferencia porcentual no calculable para este escenario (referencia en cero)."}
          </p>
        </div>
      )}
    </section>
  );
}
