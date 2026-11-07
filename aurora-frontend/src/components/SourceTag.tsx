import type { FuenteDatos } from "../types/aurora";

/** Etiqueta visual que distingue SIEMPRE si lo mostrado vino del backend real o de la muestra DEMO. */
export function SourceTag({ fuente }: { fuente: FuenteDatos }) {
  if (fuente === "live") {
    return <span className="source-tag source-tag--live">EN VIVO · backend Java</span>;
  }
  return <span className="source-tag source-tag--demo">DEMO · muestra, no es una ejecución real</span>;
}
