import type { CicloDto } from "../types/aurora";

/** Tabla cruda de ciclos — refleja 1:1 el arreglo "ciclos" devuelto por el backend (sin transformar valores). */
export function CycleTable({ ciclos }: { ciclos: CicloDto[] }) {
  return (
    <table className="cycle-table">
      <thead>
        <tr>
          <th>Ciclo</th>
          <th>Fase</th>
          <th>Duración (s)</th>
          <th>Descargados</th>
          <th>Espera NS</th>
          <th>Espera EO</th>
          <th>Cola total</th>
          <th>Espera acum. (veh·s)</th>
        </tr>
      </thead>
      <tbody>
        {ciclos.map((ciclo) => (
          <tr key={ciclo.numeroCiclo}>
            <td>{ciclo.numeroCiclo}</td>
            <td>{ciclo.faseActiva}</td>
            <td>{ciclo.duracionAccionSegundos}</td>
            <td>{ciclo.vehiculosDescargados}</td>
            <td>{ciclo.vehiculosEsperaNorteSur}</td>
            <td>{ciclo.vehiculosEsperaEsteOeste}</td>
            <td>{ciclo.longitudColaTotal}</td>
            <td>{ciclo.tiempoEsperaAcumuladoVehSeg.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
