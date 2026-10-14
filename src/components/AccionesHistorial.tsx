"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { enviarPorLotes } from "@/lib/comunicaciones/lotes";

/**
 * Completa una comunicación ya creada: envía a los destinatarios que no
 * alcanzaron a procesarse o reintenta los fallidos. El servidor no repite lo
 * que ya quedó "enviado".
 */
export default function AccionesHistorial({
  comunicacionId,
  pendientes,
  fallidos,
}: {
  comunicacionId: string;
  pendientes: string[];
  fallidos: string[];
}) {
  const router = useRouter();
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ejecutar(ids: string[], pregunta: string) {
    if (!confirm(pregunta)) return;
    setError(null);
    setProgreso({ hechos: 0, total: ids.length });
    const fallo = await enviarPorLotes(comunicacionId, ids, (_, procesados) =>
      setProgreso({ hechos: procesados, total: ids.length })
    );
    if (fallo) setError(fallo);
    setProgreso(null);
    router.refresh();
  }

  if (pendientes.length === 0 && fallidos.length === 0) return null;

  if (progreso) {
    return (
      <p className="mt-2 text-xs font-medium text-primary">
        Enviando… {progreso.hechos} de {progreso.total}
      </p>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {pendientes.length > 0 && (
        <button
          type="button"
          onClick={() =>
            ejecutar(
              pendientes,
              `Se enviará esta comunicación a los ${pendientes.length} estudiante(s) que no la recibieron. ¿Continuar?`
            )
          }
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark"
        >
          Enviar a los {pendientes.length} que faltan
        </button>
      )}
      {fallidos.length > 0 && (
        <button
          type="button"
          onClick={() =>
            ejecutar(
              fallidos,
              `Se reintentarán los envíos fallidos de ${fallidos.length} estudiante(s). Lo que ya salió no se repite. ¿Continuar?`
            )
          }
          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          Reintentar fallidos ({fallidos.length})
        </button>
      )}
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}
