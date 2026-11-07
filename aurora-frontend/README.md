# AURORA — Frontend (React 19 + TypeScript + Vite)

Interfaz web que consume el **backend Java real** de AURORA
(`../aurora-java`, paquete `com.aurora.api`) a través de su API HTTP REST.
Este proyecto **no reimplementa ninguna lógica de negocio**: no simula
colas, no calcula métricas ni diferencias porcentuales — todo eso ocurre en
el backend Java (`MotorSemaforico`, `ControladorFactory`,
`ObservadorMetricas`). El frontend solo solicita, muestra y, cuando el
backend no está disponible, cae honestamente a una **muestra DEMO**
claramente etiquetada.

> Ver `../TRAZABILIDAD.md` para la matriz completa de qué componente
> consume qué endpoint, y qué fue verificado en vivo (curl + Playwright) en
> este entorno.

---

## 1. Requisitos

- Node.js 20+ y npm
- El backend `aurora-java` corriendo (ver más abajo) — o nada, si solo
  quieres ver la interfaz en modo DEMO.

## 2. Configuración

```bash
cp .env.example .env
```

Edita `.env` y define la URL del backend:

```
VITE_API_BASE_URL=http://localhost:8100
```

(El puerto por defecto de `com.aurora.api.ApiMain` es `localhost:8100`; usa `8099` o
cualquier otro si así arrancaste el backend — ver sección 3).

## 3. Levantar el backend primero

En otra terminal, desde `../aurora-java`:

```bash
mvn compile
AURORA_API_PORT=8099 mvn exec:java -Dexec.mainClass=com.aurora.api.ApiMain
```

Deberías ver:
```
AURORA API escuchando en http://localhost:8100
```

> **Importante:** el backend tiene DOS puntos de entrada independientes:
> - `com.aurora.Main` → la demo de consola original (sin cambios).
> - `com.aurora.api.ApiMain` → el servidor HTTP que este frontend consume.
>
> Debes ejecutar el segundo para que la interfaz web funcione en modo
> conectado.

## 4. Ejecutar el frontend

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`. Si el backend está corriendo y accesible en la
URL de `VITE_API_BASE_URL`, el badge superior mostrará **"Backend Java
conectado"** y cada resultado llevará la insignia **"EN VIVO · backend
Java"**. Si el backend no responde, la interfaz cae automáticamente a **modo
DEMO** (datos de muestra, congelados de una ejecución real anterior,
siempre etiquetados como tales — nunca presentados como datos en vivo).

También puedes forzar el modo DEMO manualmente con el checkbox "Forzar modo
DEMO", útil para presentar la interfaz sin depender de que el backend esté
corriendo.

## 5. Build de producción

```bash
npm run build   # tsc -b && vite build
npm run preview # sirve dist/ localmente para revisarlo
```

## 6. Qué expone cada pantalla

| Pantalla | Qué hace | Endpoint real |
|---|---|---|
| Encabezado (badge de conexión) | Verifica si el backend está vivo, cada 15s | `GET /api/health` |
| "Configuración del backend" | Muestra los parámetros reales del Singleton `ConfiguracionAurora` | `GET /api/config` |
| "Gemelo digital" | Visualizador Canvas 2D de la intersección (carros, semáforos, interpolación con rAF). Modo Backend reproduce los ciclos reales; modo DEMO usa un flujo sintético etiquetado | `POST /api/simulaciones`, `POST /api/simulaciones/comparar` |
| "Ejecutar una estrategia" | Construye el controlador vía el Factory del backend y corre `MotorSemaforico` | `GET /api/controladores`, `POST /api/simulaciones` |
| "Comparar estrategias" | Corre ambas estrategias bajo las mismas condiciones y muestra la diferencia % calculada por el backend | `POST /api/simulaciones/comparar` |

## 7. Estructura

```
aurora-frontend/
  .env.example
  src/
    types/aurora.ts          # Tipos que reflejan EXACTAMENTE las respuestas reales del backend
    services/apiClient.ts    # Única capa que llama fetch() — centraliza VITE_API_BASE_URL
    services/comparacion.ts  # elige el lider parcial de la comparacion
    services/demoFixtures.ts # Muestra DEMO (copia congelada de respuestas reales)
    hooks/useBackendConnection.ts
    components/
      ConnectionBadge.tsx    # Estado de conexión
      SourceTag.tsx          # Etiqueta "EN VIVO" vs "DEMO" en cada resultado
      ConfigPanel.tsx
      SimulationPanel.tsx
      ComparisonPanel.tsx
      CycleTable.tsx
      MetricsSummary.tsx
      PhaseBar.tsx           # fase activa + cuenta regresiva
      ComparisonMarker.tsx   # quien lleva menos espera (mismo nº de ciclos)
      TwinPanel.tsx / TwinView.tsx / TrafficCanvas.tsx   # gemelo digital
    viz/                     # SceneStore, renderer, geometry, BackendPlayback, DemoFeed, TrafficKinematics
```

> **Sobre el gemelo digital:** el backend no entrega X/Y, ángulo ni amarillo. Las posiciones de los carros se derivan en el frontend a partir de las colas y descargas reales de cada ciclo (solo visual). La HUD compara la cola del backend contra la dibujada en cada ciclo.
