import { useEffect, useState } from "react";
import { auroraApi, ApiError } from "../services/apiClient";
import { DEMO_CONFIG } from "../services/demoFixtures";
import type { ConfigResponse, FuenteDatos } from "../types/aurora";
import { SourceTag } from "./SourceTag";

const ETIQUETAS: Record<keyof ConfigResponse, string> = {
  duracionFaseFijaSegundos: "Duración fase fija",
  duracionMinimaAdaptativaSegundos: "Duración mínima (adaptativo)",
  duracionMaximaAdaptativaSegundos: "Duración máxima (adaptativo)",
  umbralCongestionVehiculos: "Umbral de congestión",
  numeroCiclosSimulacion: "Ciclos de simulación por defecto",
  segundosPorVehiculoDescarga: "Segundos por vehículo descargado",
  llegadaVehiculosNorteSurPorCiclo: "Llegadas Norte-Sur / ciclo",
  llegadaVehiculosEsteOestePorCiclo: "Llegadas Este-Oeste / ciclo",
  vehiculosInicialesNorteSur: "Vehículos iniciales Norte-Sur",
  vehiculosInicialesEsteOeste: "Vehículos iniciales Este-Oeste",
};

/** Panel que consume GET /api/config — expone los parámetros reales del Singleton ConfiguracionAurora. */
export function ConfigPanel({ modoDemo }: { modoDemo: boolean }) {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [fuente, setFuente] = useState<FuenteDatos>("demo");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);

    if (modoDemo) {
      setConfig(DEMO_CONFIG);
      setFuente("demo");
      setCargando(false);
      return;
    }

    auroraApi
      .obtenerConfiguracion()
      .then((respuesta) => {
        if (cancelado) return;
        setConfig(respuesta);
        setFuente("live");
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        setError(err instanceof ApiError ? err.message : "Error desconocido al consultar /api/config");
        setConfig(DEMO_CONFIG);
        setFuente("demo");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [modoDemo]);

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Configuración del backend</h2>
        <SourceTag fuente={fuente} />
      </header>
      {cargando && <p className="panel__estado">Cargando configuración…</p>}
      {error && <p className="panel__error">{error} — mostrando valores DEMO en su lugar.</p>}
      {config && (
        <dl className="config-grid">
          {(Object.keys(ETIQUETAS) as (keyof ConfigResponse)[]).map((clave) => (
            <div className="config-grid__item" key={clave}>
              <dt>{ETIQUETAS[clave]}</dt>
              <dd>{config[clave]}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
