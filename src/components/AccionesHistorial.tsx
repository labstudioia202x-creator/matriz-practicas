"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAvisoAlSalir } from "@/lib/comunicaciones/avisoAlSalir";
import { enviarPorLotes } from "@/lib/comunicaciones/lotes";

type Accion = { ids: string[]; pregunta: string };

/**
 * Completa una comunicación ya creada: envía a los destinatarios que no
 * alcanzaron a procesarse o reintenta los fallidos. El servidor no repite lo
 * que ya quedó "enviado".
 *
 * La confirmación va dentro de la página y no con `confirm()`: el navegador
 * deja bloquear sus cuadros de diálogo y entonces `confirm()` devuelve false
 * sin mostrar nada, y el botón parecía no hacer nada.
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
  const [porConfirmar, setPorConfirmar] = useState<Accion | null>(null);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useAvisoAlSalir(progreso !== null);

  async function ejecutar(ids: string[]) {
    setPorConfirmar(null);
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
      <p role="status" className="mt-2 text-xs font-medium text-primary">
        Enviando… {progreso.hechos} de {progreso.total}.{" "}
        <span className="text-amber-800">
          No cierres ni recargues esta página hasta que termine.
        </span>
      </p>
    );
  }

  if (porConfirmar) {
    return (
      <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
        <p className="font-medium text-slate-800">{porConfirmar.pregunta}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => ejecutar(porConfirmar.ids)}
            className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white transition hover:bg-primary-dark"
          >
            Sí, enviar
          </button>
          <button
            type="button"
            onClick={() => setPorConfirmar(null)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {pendientes.length > 0 && (
        <button
          type="button"
          onClick={() =>
            setPorConfirmar({
              ids: pendientes,
              pregunta: `Se enviará esta comunicación a los ${pendientes.length} estudiante(s) que no la recibieron. ¿Continuar?`,
            })
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
            setPorConfirmar({
              ids: fallidos,
              pregunta: `Se reintentarán los envíos fallidos de ${fallidos.length} estudiante(s). Lo que ya salió no se repite. ¿Continuar?`,
            })
          }
          className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          Reintentar fallidos ({fallidos.length})
        </button>
      )}
      {error && (
        <p role="alert" className="w-full rounded-lg border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
