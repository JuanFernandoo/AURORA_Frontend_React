import { useState } from "react";
import "./App.css";
import { ComparisonPanel } from "./components/ComparisonPanel";
import { ConfigPanel } from "./components/ConfigPanel";
import { ConnectionBadge } from "./components/ConnectionBadge";
import { SimulationPanel } from "./components/SimulationPanel";
import { TwinPanel } from "./components/TwinPanel";
import { useBackendConnection } from "./hooks/useBackendConnection";

type Pestana = "gemelo" | "simular" | "comparar";

const PESTANAS: ReadonlyArray<{ id: Pestana; etiqueta: string }> = [
  { id: "gemelo", etiqueta: "Gemelo digital" },
  { id: "simular", etiqueta: "Una estrategia" },
  { id: "comparar", etiqueta: "Comparar" },
];

function App() {
  const conexion = useBackendConnection();
  const [pestana, setPestana] = useState<Pestana>("gemelo");
  const [forzarDemo, setForzarDemo] = useState(false);

  const modoDemo = forzarDemo || conexion.estado === "fuera_de_linea";

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera__fila">
          <span className="marca">Aurora</span>
          <ConnectionBadge {...conexion} />
        </div>
        <nav className="tabs" aria-label="Secciones">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={pestana === p.id ? "tabs__boton tabs__boton--activo" : "tabs__boton"}
              aria-current={pestana === p.id ? "page" : undefined}
              onClick={() => setPestana(p.id)}
            >
              {p.etiqueta}
            </button>
          ))}
        </nav>
      </header>

      <section className="intro">
        <h1>Semáforo fijo frente a semáforo adaptativo</h1>
        <p>
          Compara un ciclo fijo tradicional con un controlador que reparte el verde según los vehículos que
          esperan. Los cálculos los hace un backend en Java; esta página los muestra y los anima.
        </p>
        <p className="intro__nota">
          Simulación con tráfico sintético de una sola intersección, no mediciones de una vía real.
        </p>
      </section>

      <main>
        {pestana === "gemelo" && (
          <TwinPanel modoDemo={modoDemo} conectando={conexion.estado === "verificando"} />
        )}
        {pestana === "simular" && <SimulationPanel modoDemo={modoDemo} />}
        {pestana === "comparar" && <ComparisonPanel modoDemo={modoDemo} />}
      </main>

      <details className="tecnico">
        <summary>Detalles técnicos</summary>
        <div className="tecnico__cuerpo">
          <label className="forzar-demo">
            <input type="checkbox" checked={forzarDemo} onChange={(e) => setForzarDemo(e.target.checked)} />
            Usar el modo demo aunque el backend esté disponible
          </label>
          <ConfigPanel modoDemo={modoDemo} />
          <p className="tecnico__meta">
            Backend <code>{conexion.baseUrl}</code> (se cambia con <code>VITE_API_BASE_URL</code>). Arquitectura:
            Strategy, Singleton, Observer y Factory.
          </p>
          {conexion.ultimoError && <p className="tecnico__meta">Último error: {conexion.ultimoError}</p>}
        </div>
      </details>
    </div>
  );
}

export default App;
