import type {
  CompararResultado,
  ConfigResponse,
  ControladoresResponse,
  HealthResponse,
  SimulacionResultado,
  TipoControlador,
} from "../types/aurora";

/**
 * Capa de servicios HTTP para comunicarse con el backend Java real
 * (com.aurora.api.AuroraApiServer). Cada funcion aqui corresponde a un
 * endpoint que fue efectivamente probado con curl contra el servidor en
 * ejecucion (ver TRAZABILIDAD.md). No hay endpoints inventados.
 *
 * La URL base se centraliza mediante la variable de entorno
 * VITE_API_BASE_URL (ver .env.example). Si no esta definida, se usa
 * http://localhost:8100 como valor por defecto (el puerto por defecto de
 * com.aurora.api.ApiMain).
 */

const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ??
  "http://localhost:8100";

/** Tiempo maximo de espera para una simulacion (el servidor gratuito puede estar despertando). */
const TIMEOUT_MS = 30000;
/** Tiempo maximo para la comprobacion de salud: el plan gratuito de Render puede tardar ~1 min en despertar. */
const TIMEOUT_SALUD_MS = 65000;

export class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Error especifico para cuando el backend es inalcanzable (servidor apagado, red, CORS, timeout). */
export class BackendUnreachableError extends ApiError {
  constructor(cause?: unknown) {
    super(
      cause instanceof Error
        ? `No se pudo contactar al backend de AURORA en ${BASE_URL}: ${cause.message}`
        : `No se pudo contactar al backend de AURORA en ${BASE_URL}.`,
    );
    this.name = "BackendUnreachableError";
  }
}

async function solicitar<T>(ruta: string, init?: RequestInit, timeoutMs: number = TIMEOUT_MS): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${BASE_URL}${ruta}`, {
      ...init,
      signal: controlador.signal,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new BackendUnreachableError(error);
  } finally {
    clearTimeout(temporizador);
  }

  let cuerpo: unknown = null;
  const texto = await respuesta.text();
  if (texto) {
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      // El backend siempre responde JSON; si esto ocurre, se reporta tal cual.
      throw new ApiError(
        `Respuesta no es JSON valido (status ${respuesta.status}): ${texto.slice(0, 200)}`,
        respuesta.status,
      );
    }
  }

  if (!respuesta.ok) {
    const mensaje =
      cuerpo && typeof cuerpo === "object" && "error" in cuerpo
        ? String((cuerpo as { error: unknown }).error)
        : `Error HTTP ${respuesta.status}`;
    throw new ApiError(mensaje, respuesta.status);
  }

  return cuerpo as T;
}

export const auroraApi = {
  baseUrl: BASE_URL,

  /** GET /api/health — verificado con curl, responde {"status":"ok","servicio":"aurora-java-api","version":"1.0.0"}. */
  obtenerSalud(): Promise<HealthResponse> {
    return solicitar<HealthResponse>("/api/health", { method: "GET" }, TIMEOUT_SALUD_MS);
  },

  /** GET /api/config — expone los parametros reales del Singleton ConfiguracionAurora. */
  obtenerConfiguracion(): Promise<ConfigResponse> {
    return solicitar<ConfigResponse>("/api/config", { method: "GET" });
  },

  /** GET /api/controladores — tipos reales que acepta la Factory del backend (CICLO_FIJO, ADAPTATIVO). */
  obtenerControladoresDisponibles(): Promise<ControladoresResponse> {
    return solicitar<ControladoresResponse>("/api/controladores", { method: "GET" });
  },

  /**
   * POST /api/simulaciones — ejecuta UNA estrategia real en el backend
   * (construida por ControladorFactory, corrida por MotorSemaforico).
   * numeroCiclos es opcional; si se omite, el backend usa el valor
   * configurado en ConfiguracionAurora.
   */
  ejecutarSimulacion(
    tipoControlador: TipoControlador,
    numeroCiclos?: number,
  ): Promise<SimulacionResultado> {
    return solicitar<SimulacionResultado>("/api/simulaciones", {
      method: "POST",
      body: JSON.stringify({
        tipoControlador,
        ...(numeroCiclos ? { numeroCiclos } : {}),
      }),
    });
  },

  /**
   * POST /api/simulaciones/comparar — ejecuta AMBAS estrategias bajo las
   * mismas condiciones y devuelve, entre otros datos, la diferencia
   * porcentual real calculada por el backend (no se recalcula en el
   * frontend).
   */
  compararEstrategias(numeroCiclos?: number): Promise<CompararResultado> {
    return solicitar<CompararResultado>("/api/simulaciones/comparar", {
      method: "POST",
      body: JSON.stringify(numeroCiclos ? { numeroCiclos } : {}),
    });
  },
};
