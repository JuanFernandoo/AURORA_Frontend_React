# AURORA — Matriz de trazabilidad Frontend (React) ↔ Backend (Java)

Este documento certifica, con evidencia real capturada en este entorno, qué
endpoint HTTP real del backend `aurora-java` consume cada componente del
frontend `aurora-frontend`, y qué quedó pendiente.

**Metodología de verificación (ejecutada en esta sesión, no asumida):**

1. Se compiló el backend completo (`src/main` + el paquete nuevo `com.aurora.api`)
   con `javac` directo — 0 errores, 0 warnings.
2. Se arrancó `com.aurora.api.ApiMain` en el puerto `8099` (el mismo que usa
   `aurora-frontend/.env`) y se golpeó **cada endpoint real con `curl`**,
   incluyendo casos de error (tipo inválido, campo faltante, método no
   permitido, preflight CORS).
3. Se compiló el frontend (`tsc -b && vite build`) — 0 errores de TypeScript.
4. Se levantó el frontend con `vite` y se abrió en un navegador headless
   (Playwright/Chromium) apuntando al backend real en `:8099`: se ejecutó una
   simulación, se ejecutó una comparación, y se leyeron los valores
   **tal como los renderizó React en el DOM** — no se inspeccionó el código,
   se verificó el resultado visual real.
5. Se apagó el backend y se repitió la prueba para confirmar la caída
   honesta a modo DEMO (badge e insignia `source-tag` cambian correctamente,
   sin presentar datos de muestra como si fueran reales).

---

## 1. Endpoints reales del backend (confirmados por ejecución, no por lectura de código)

| Método | Ruta | Request body | Response (verificado con curl) | Clases Java involucradas |
|---|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok","servicio":"aurora-java-api","version":"1.0.0"}` | `AuroraApiServer.manejarHealth` |
| GET | `/api/config` | — | 10 campos numéricos, ver abajo | `AuroraApiServer.manejarConfig` → `ConfiguracionAurora` (Singleton) |
| GET | `/api/controladores` | — | `{"tipos":["CICLO_FIJO","ADAPTATIVO"]}` | `AuroraApiServer.manejarControladores` → `TipoControlador` (enum del Factory) |
| POST | `/api/simulaciones` | `{"tipoControlador":"CICLO_FIJO"\|"ADAPTATIVO","numeroCiclos"?:number}` | objeto `SimulacionResultado` (ver abajo) | `SimulacionApiService.ejecutar` → `ControladorFactory` (Factory) → `MotorSemaforico` (Strategy+Observer) → `ObservadorMetricas` |
| POST | `/api/simulaciones/comparar` | `{"numeroCiclos"?:number}` | objeto `CompararResultado` con ambas estrategias + diferencia % | `SimulacionApiService.comparar` (llama dos veces a `ejecutar`) |
| OPTIONS | cualquiera de los anteriores | — | `204 No Content` + cabeceras CORS | `AuroraApiServer.manejarPreflight` |

**Respuesta real capturada — `GET /api/config`:**
```json
{"duracionFaseFijaSegundos":15,"duracionMinimaAdaptativaSegundos":10,"duracionMaximaAdaptativaSegundos":40,"umbralCongestionVehiculos":8,"numeroCiclosSimulacion":15,"segundosPorVehiculoDescarga":2,"llegadaVehiculosNorteSurPorCiclo":3,"llegadaVehiculosEsteOestePorCiclo":2,"vehiculosInicialesNorteSur":12,"vehiculosInicialesEsteOeste":8}
```

**Respuesta real capturada — `POST /api/simulaciones/comparar` (`{"numeroCiclos":2}`):**
```json
{"cicloFijo":{...,"metricas":{"tiempoEsperaAcumuladoVehSeg":510.0,...}},"adaptativo":{...,"metricas":{"tiempoEsperaAcumuladoVehSeg":472.0,...}},"diferenciaPorcentualEsperaAcumulada":7.5,"diferenciaCalculable":true}
```

**Casos de error confirmados:**
- `tipoControlador` inválido → `400` + `{"error":"tipoControlador invalido: ..."}`
- `tipoControlador` ausente → `400` + `{"error":"El campo \"tipoControlador\" es obligatorio..."}`
- Método no permitido (p. ej. `DELETE /api/health`) → `405`

No existen más endpoints que estos cinco. El frontend no asume ni llama ninguno adicional.

---

## 2. Matriz de trazabilidad Componente React ↔ Endpoint ↔ Funcionalidad del backend

| Componente / hook React | Archivo | Endpoint(s) real(es) consumido(s) | Funcionalidad del backend que expone | Estado |
|---|---|---|---|---|
| `useBackendConnection` | `src/hooks/useBackendConnection.ts` | `GET /api/health` | Disponibilidad del servidor HTTP (`AuroraApiServer`) | ✅ Verificado en vivo (badge "Backend Java conectado" / "no disponible") |
| `ConfigPanel` | `src/components/ConfigPanel.tsx` | `GET /api/config` | Parámetros reales del Singleton `ConfiguracionAurora` | ✅ Verificado en vivo (10 campos renderizados = respuesta curl) |
| `SimulationPanel` (carga de opciones) | `src/components/SimulationPanel.tsx` | `GET /api/controladores` | Tipos que acepta el Factory (`TipoControlador`) | ✅ Verificado en vivo |
| `SimulationPanel` (ejecutar) | `src/components/SimulationPanel.tsx` | `POST /api/simulaciones` | `ControladorFactory` + `MotorSemaforico` (Strategy) + `ObservadorMetricas` (Observer) de UNA estrategia | ✅ Verificado en vivo con Playwright: métricas en pantalla (9.13 / 13 / 1632.0 / 9) idénticas a la respuesta curl de 15 ciclos ADAPTATIVO |
| `ComparisonPanel` | `src/components/ComparisonPanel.tsx` | `POST /api/simulaciones/comparar` | Ejecuta ambas estrategias + diferencia % calculada **en el backend** | ✅ Verificado en vivo con Playwright: "29.4%" en pantalla, igual al resultado de la demo de consola original (`Main.java`) con los mismos 15 ciclos por defecto |
| `CycleTable` | `src/components/CycleTable.tsx` | (recibe props, no llama HTTP) | Renderiza 1:1 el arreglo `ciclos` de `SimulacionResultado` | ✅ Sin transformación de datos, solo presentación |
| `MetricsSummary` | `src/components/MetricsSummary.tsx` | (recibe props, no llama HTTP) | Renderiza 1:1 el objeto `metricas` | ✅ Sin transformación de datos |
| `ConnectionBadge` / `SourceTag` | `src/components/*.tsx` | (presentación de estado) | Indican honestamente si el dato en pantalla es `live` o `demo` | ✅ Verificado en vivo (cambia correctamente al apagar el backend) |
| `demoFixtures.ts` | `src/services/demoFixtures.ts` | — (ninguno; es el *fallback*) | Copia congelada de respuestas reales ya capturadas, usada SOLO si `GET /api/health` falla o el usuario fuerza "modo DEMO" | ✅ Nunca se presenta como dato `live`; etiquetado explícito en toda la UI |

## 2b. Gemelo digital (visualizador Canvas 2D) ↔ Backend

| Componente | Archivo | Endpoint real | De dónde sale cada dato dibujado | Estado |
|---|---|---|---|---|
| `TwinPanel` (modo Backend) | `src/components/TwinPanel.tsx` | `POST /api/simulaciones`, `POST /api/simulaciones/comparar` | Fase activa, duración, descargados y colas **vienen del backend** (`ciclos[]`) | Verificado con Playwright: 15/15 ciclos con cola dibujada = cola del backend |
| `BackendPlayback` | `src/viz/backendPlayback.ts` | (recibe el resultado ya pedido) | Reproduce `ciclos[]`. **Derivado en el frontend (visual, no del backend):** posición X/Y, ángulo, velocidad, orden de salida y momento de llegada de cada carro | Verificado |
| `DemoFeed` | `src/viz/demoFeed.ts` | ninguno | Todo sintético (semilla fija), incluye amarillo y todo-rojo. Etiquetado DEMO | Verificado |
| `TrafficCanvas`, `SceneStore`, `renderer`, `geometry`, `TrafficKinematics` | `src/viz/*`, `src/components/TrafficCanvas.tsx` | ninguno | Solo dibujo e interpolación (rAF) | Verificado |

**Capa de legibilidad (solo presentación):** `PhaseBar` (fase activa + cuenta regresiva en segundos simulados, leída de `faseActiva`/`duracionAccionSegundos` del backend) y contadores por acceso dibujados en el canvas (`drawQueueBadges`). Los contadores N/S y E/O por separado son del reparto visual del frontend; su suma sí coincide con la cola del backend (verificado 15/15 ciclos).

**Panel de métricas y marcador de comparación:**
- `drawMetricsPanel` (canvas, manzana superior izquierda): ciclo, espera acumulada y vehículos cruzados salen de los ciclos ya cerrados de la respuesta del backend (`tiempoEsperaAcumuladoVehSeg`, `vehiculosDescargados`). "Cola total" es la suma de los contadores dibujados. En DEMO solo muestra la cola total y se rotula "sin métricas reales".
- `ComparisonMarker` + `services/comparacion.ts`: compara las dos estrategias tras el MISMO número de ciclos completos (el mínimo que ya cerraron ambas reproducciones), leyendo los valores del backend y eligiendo el menor. No calcula porcentajes: el 29.4 % final sigue siendo el que calcula el backend. Es normal que al ciclo 1 gane el Ciclo Fijo (270.0 vs 312.0) y luego pase a liderar el Adaptativo.

**Limitaciones declaradas:**
- El backend **no** emite X/Y, ángulo, streaming ni estado amarillo. Solo conteos de cola por ciclo, fase, duración y descargados.
- En modo Backend el amarillo no se dibuja (el backend no lo modela); las luces cambian verde/rojo directo.
- Los carros individuales son una representación visual coherente con los conteos; no son vehículos simulados por Java.
- Para posiciones reales haría falta cinemática por vehículo en el motor Java y un canal continuo (SSE/WebSocket/polling). No se implementó.

---

## 3. Qué queda pendiente / fuera de alcance

| Pendiente | Por qué no se hizo | Cómo cerrarlo |
|---|---|---|
| El backend solo soporta la intersección fija de 2 flujos (Norte-Sur / Este-Oeste) con los parámetros de `ConfiguracionAurora`; no hay endpoint para cambiar vehículos iniciales ni parámetros de la heurística vía API. | No formaba parte del alcance original del backend de consola; agregarlo requeriría nuevos endpoints (`PUT /api/config` o similar) y decidir si `ConfiguracionAurora` deja de ser inmutable. | Se puede añadir como cambio incremental en `com.aurora.api`, sin tocar `strategy`/`observer`/`factory`. |
| El parser JSON (`SimpleJsonParser`) solo soporta objetos planos de un nivel. | Es deliberado: evita agregar Jackson/Gson al `pom.xml` original. Suficiente para los 2 cuerpos de request reales que existen hoy. | Si se necesitan cuerpos anidados en el futuro, reemplazar por una librería JSON real. |
| No hay autenticación ni HTTPS en la API. | Fuera de alcance para un prototipo académico de demostración local. | No se recomienda exponerlo fuera de `localhost` sin agregarlo. |
| Pruebas automatizadas del frontend (Vitest/Testing Library) o del API HTTP (tests de integración Java). | El backend ya tiene JUnit 5 para las clases de dominio (Strategy/Singleton/Observer/Factory); el paquete `com.aurora.api` y el frontend no tienen pruebas automatizadas propias — esta verificación fue manual (curl + Playwright), documentada aquí. | Se podría agregar `HttpClient`-based tests en Java para `com.aurora.api`, y Vitest + `@testing-library/react` en el frontend. |
| `oxlint` reporta 3 advertencias `react(set-state-in-effect)` (no errores) en `ConfigPanel.tsx`, `useBackendConnection.ts` y `SimulationPanel.tsx`. | Son advertencias de estilo sobre `setState` dentro de callbacks de promesas iniciadas en `useEffect`; no afectan la corrección funcional (confirmado por la verificación en vivo) y no bloquean el build. | Opcional: refactorizar a `useEffect` con una función async interna, o silenciar la regla si se considera un falso positivo. |

---

## 4. Cómo reproducir esta verificación

```bash
# 1) Backend
cd aurora-java
mvn compile
AURORA_API_PORT=8099 mvn exec:java -Dexec.mainClass=com.aurora.api.ApiMain
# (deja esta terminal corriendo)

# 2) Frontend, en otra terminal
cd aurora-frontend
cp .env.example .env   # y edita VITE_API_BASE_URL=http://localhost:8100
npm install
npm run dev
# abre http://localhost:5173

# 3) Verificación manual rápida de los endpoints (opcional, en una tercera terminal)
# GET (Están bien)
curl http://localhost:8100/api/health
curl http://localhost:8100/api/config
curl http://localhost:8100/api/controladores

# POST (Corregidos con el encabezado JSON)
curl -X POST http://localhost:8100/api/simulaciones \
  -H "Content-Type: application/json" \
  -d '{"tipoControlador":"ADAPTATIVO","numeroCiclos":15}'

curl -X POST http://localhost:8100/api/simulaciones/comparar \
  -H "Content-Type: application/json" \
  -d '{"numeroCiclos":15}'

Con el backend corriendo, el badge superior de la interfaz debe decir
**"Backend Java conectado"** y cada resultado debe mostrar la insignia
**"EN VIVO · backend Java"**. Si detienes el backend (Ctrl+C) y recargas la
página, el badge cambia a **"Backend Java no disponible — mostrando modo
DEMO"** y los resultados muestran **"DEMO · muestra, no es una ejecución
real"** — esto confirma que el frontend nunca presenta datos de muestra como
si fueran una ejecución real.
