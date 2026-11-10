import { useState } from "react";
import "./App.css";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { ConfigPanel } from "./components/ConfigPanel";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { SimulationPanel } from "./components/SimulationPanel";
import { TwinPanel } from "./components/TwinPanel";
import { useBackendConnection } from "./hooks/useBackendConnection";

type Pestana = "gemelo" | "simular" | "comparar";

function App() {
  const conexion = useBackendConnection();
  const [pestana, setPestana] = useState<Pestana>("gemelo");
  const [forzarDemo, setForzarDemo] = useState(false);

  const modoDemo = forzarDemo || conexion.estado === "fuera_de_linea";

  return (
    <div className="app">
      <header className="app__header">
        <h1>AURORA — Semaforización inteligente</h1>
        <p className="app__subtitulo">
          Compara un semáforo tradicional (ciclo fijo) con uno que se adapta a los vehículos que esperan. Los
          cálculos los hace un backend en Java; esta página los muestra y los anima.
        </p>
        <p className="app__aviso-simulacion">
          Simulación con tráfico sintético de una sola intersección. No son mediciones en una vía real.
        </p>
      </header>

      <ConnectionBadge {...conexion} />

      <label className="forzar-demo">
        <input
          type="checkbox"
          checked={forzarDemo}
          onChange={(e) => setForzarDemo(e.target.checked)}
        />
        Forzar modo DEMO (ignorar el backend aunque esté disponible)
      </label>

      <nav className="tabs">
        <button
          type="button"
          className={pestana === "gemelo" ? "tabs__boton tabs__boton--activo" : "tabs__boton"}
          onClick={() => setPestana("gemelo")}
        >
          Gemelo digital
        </button>
        <button
          type="button"
          className={pestana === "simular" ? "tabs__boton tabs__boton--activo" : "tabs__boton"}
          onClick={() => setPestana("simular")}
        >
          Ejecutar una estrategia
        </button>
        <button
          type="button"
          className={pestana === "comparar" ? "tabs__boton tabs__boton--activo" : "tabs__boton"}
          onClick={() => setPestana("comparar")}
        >
          Comparar estrategias
        </button>
      </nav>

      {pestana === "gemelo" && (
        <TwinPanel modoDemo={modoDemo} conectando={conexion.estado === "verificando"} />
      )}
      {pestana === "simular" && <SimulationPanel modoDemo={modoDemo} />}
      {pestana === "comparar" && <ComparisonPanel modoDemo={modoDemo} />}

      <details className="config-colapsable">
        <summary>Detalles técnicos: configuración del backend (parámetros del Singleton)</summary>
        <ConfigPanel modoDemo={modoDemo} />
      </details>

      <footer className="app__footer">
        <p>
          Backend: <code>{conexion.baseUrl}</code> · Arquitectura: Strategy + Singleton + Observer + Factory ·
          Configurable vía <code>VITE_API_BASE_URL</code>
        </p>
      </footer>
    </div>
  );
}

export default App;
