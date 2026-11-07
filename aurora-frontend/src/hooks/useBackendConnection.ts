import { useCallback, useEffect, useRef, useState } from "react";
import { auroraApi } from "../services/apiClient";
import type { HealthResponse } from "../types/aurora";

export type EstadoConexion = "verificando" | "en_linea" | "fuera_de_linea";

interface UseBackendConnectionResultado {
  estado: EstadoConexion;
  salud: HealthResponse | null;
  ultimoError: string | null;
  baseUrl: string;
  /** Vuelve a intentar GET /api/health inmediatamente (botón "Reintentar conexión"). */
  reintentar: () => void;
}

const INTERVALO_REVISION_MS = 15000;

/**
 * Verifica, mediante el endpoint real GET /api/health, si el backend Java
 * de AURORA esta disponible. Esto decide si la interfaz opera en modo
 * conectado (datos reales) o cae a modo DEMO (ver demoFixtures.ts) — nunca
 * se presentan datos de muestra como si fueran una respuesta real del
 * backend.
 */
export function useBackendConnection(): UseBackendConnectionResultado {
  const [estado, setEstado] = useState<EstadoConexion>("verificando");
  const [salud, setSalud] = useState<HealthResponse | null>(null);
  const [ultimoError, setUltimoError] = useState<string | null>(null);
  const montadoRef = useRef(true);

  const verificar = useCallback(() => {
    setEstado((previo) => (previo === "en_linea" ? previo : "verificando"));
    auroraApi
      .obtenerSalud()
      .then((respuesta) => {
        if (!montadoRef.current) return;
        setSalud(respuesta);
        setUltimoError(null);
        setEstado("en_linea");
      })
      .catch((error: unknown) => {
        if (!montadoRef.current) return;
        setSalud(null);
        setUltimoError(error instanceof Error ? error.message : String(error));
        setEstado("fuera_de_linea");
      });
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    verificar();
    const intervalo = setInterval(verificar, INTERVALO_REVISION_MS);
    return () => {
      montadoRef.current = false;
      clearInterval(intervalo);
    };
  }, [verificar]);

  return { estado, salud, ultimoError, baseUrl: auroraApi.baseUrl, reintentar: verificar };
}
