import type { CompararResultado } from "../types/aurora";
import type { ProgresoComparacion } from "../services/comparacion";

interface Props {
  comparacion: CompararResultado;
  progreso: ProgresoComparacion;
}

const W = 760;
const H = 300;
const M = { izq: 78, der: 24, arr: 40, abajo: 56 };

/** Marca "bonita" para el maximo del eje Y. */
function techo(valor: number): number {
  if (valor <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(valor)));
  const f = valor / pot;
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return paso * pot;
}

/**
 * Espera acumulada ciclo a ciclo de las dos estrategias. Las lineas se van dibujando a medida que
 * avanza cada reproduccion. Todos los valores salen de la respuesta del backend (no se recalcula nada).
 * Se distingue por color Y por trazo/marcador (no depende solo del color).
 */
export function GraficoEspera({ comparacion, progreso }: Props) {
  const fijo = comparacion.cicloFijo.ciclos;
  const adap = comparacion.adaptativo.ciclos;
  const total = Math.max(fijo.length, adap.length);
  if (total < 1) return null;

  const maxY = techo(
    Math.max(
      ...fijo.map((c) => c.tiempoEsperaAcumuladoVehSeg),
      ...adap.map((c) => c.tiempoEsperaAcumuladoVehSeg),
    ),
  );
  const x = (ciclo: number) => M.izq + ((ciclo - 1) / Math.max(total - 1, 1)) * (W - M.izq - M.der);
  const y = (v: number) => H - M.abajo - (v / maxY) * (H - M.abajo - M.arr);

  const puntos = (ciclos: typeof fijo, hasta: number) =>
    ciclos.slice(0, hasta).map((c, i) => `${x(i + 1)},${y(c.tiempoEsperaAcumuladoVehSeg)}`);

  const pFijo = puntos(fijo, progreso.fijo);
  const pAdap = puntos(adap, progreso.adaptativo);
  const ultimoFijo = progreso.fijo > 0 ? fijo[progreso.fijo - 1] : null;
  const ultimoAdap = progreso.adaptativo > 0 ? adap[progreso.adaptativo - 1] : null;

  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);
  const paso = total <= 15 ? 1 : total <= 30 ? 5 : 10;
  const marcasX = Array.from({ length: total }, (_, i) => i + 1).filter(
    (c) => c === 1 || c === total || c % paso === 0,
  );

  return (
    <figure className="grafico-espera">
      <figcaption>
        <strong>Espera acumulada ciclo a ciclo</strong>
        <span>Menos es mejor · cada línea sube porque suma la espera de todos los vehículos</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Gráfico de líneas: espera acumulada por ciclo del ciclo fijo y del adaptativo"
      >
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={M.izq} x2={W - M.der} y1={y(v)} y2={y(v)} className="grafico-espera__rejilla" />
            <text x={M.izq - 10} y={y(v) + 5} textAnchor="end" className="grafico-espera__eje">
              {Math.round(v).toLocaleString("es-CO")}
            </text>
          </g>
        ))}
        {marcasX.map((c) => (
          <text key={c} x={x(c)} y={H - M.abajo + 24} textAnchor="middle" className="grafico-espera__eje">
            {c}
          </text>
        ))}
        <text x={(M.izq + W - M.der) / 2} y={H - 8} textAnchor="middle" className="grafico-espera__titulo-eje">
          Ciclo del semáforo
        </text>
        <text
          transform={`translate(18 ${(M.arr + H - M.abajo) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="grafico-espera__titulo-eje"
        >
          Espera acumulada (veh·s)
        </text>

        {pFijo.length > 0 && (
          <polyline points={pFijo.join(" ")} className="grafico-espera__linea grafico-espera__linea--fijo" />
        )}
        {pAdap.length > 0 && (
          <polyline points={pAdap.join(" ")} className="grafico-espera__linea grafico-espera__linea--adap" />
        )}
        {ultimoFijo && (
          <g>
            <rect
              x={x(progreso.fijo) - 7}
              y={y(ultimoFijo.tiempoEsperaAcumuladoVehSeg) - 7}
              width={14}
              height={14}
              className="grafico-espera__punto--fijo"
            />
            <text
              x={Math.min(x(progreso.fijo), W - M.der - 4)}
              y={y(ultimoFijo.tiempoEsperaAcumuladoVehSeg) - 14}
              textAnchor="end"
              className="grafico-espera__valor"
            >
              {Math.round(ultimoFijo.tiempoEsperaAcumuladoVehSeg).toLocaleString("es-CO")}
            </text>
          </g>
        )}
        {ultimoAdap && (
          <g>
            <circle
              cx={x(progreso.adaptativo)}
              cy={y(ultimoAdap.tiempoEsperaAcumuladoVehSeg)}
              r={8}
              className="grafico-espera__punto--adap"
            />
            <text
              x={Math.min(x(progreso.adaptativo), W - M.der - 4)}
              y={y(ultimoAdap.tiempoEsperaAcumuladoVehSeg) + 28}
              textAnchor="end"
              className="grafico-espera__valor"
            >
              {Math.round(ultimoAdap.tiempoEsperaAcumuladoVehSeg).toLocaleString("es-CO")}
            </text>
          </g>
        )}
      </svg>
      <div className="grafico-espera__leyenda">
        <span className="grafico-espera__ley grafico-espera__ley--fijo">■ Ciclo fijo (línea discontinua)</span>
        <span className="grafico-espera__ley grafico-espera__ley--adap">● Adaptativo (línea continua)</span>
      </div>
    </figure>
  );
}
