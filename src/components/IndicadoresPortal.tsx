import { calcularCompletitud } from "@/lib/portal/guia";
import { PracticanteConDocumentos } from "@/lib/types";

const coloresAvance: Record<string, string> = {
  Inicio: "bg-amber-100 text-amber-800",
  "En curso": "bg-blue-100 text-blue-800",
  Finalizado: "bg-green-100 text-green-800",
};

/** Paso que reportó el estudiante en su portal. */
export function AvanceBadge({ avance }: { avance: string | null }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        coloresAvance[avance ?? ""] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {avance ?? "Sin reportar"}
    </span>
  );
}

/** Cuánto ha completado el estudiante: datos de la matriz y documentos. */
export function CompletitudResumen({
  practicante,
}: {
  practicante: PracticanteConDocumentos;
}) {
  const { datos, entregables } = calcularCompletitud(
    practicante,
    practicante.soportes
  );

  return (
    <span className="whitespace-nowrap text-xs text-slate-500">
      Datos {datos.hechos}/{datos.total} · Entregables {entregables.hechos}/
      {entregables.total}
    </span>
  );
}
