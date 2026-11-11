"use client";

import { useOptimistic, useState, useTransition } from "react";
import { marcarIntersemestral } from "@/app/(app)/practicantes/actions";

/** Etiqueta para los practicantes que siguen en el intersemestral. */
export function EtiquetaIntersemestral() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
      Intersemestral
    </span>
  );
}

/**
 * Casilla para marcar o desmarcar al practicante como intersemestral desde la
 * lista, sin abrir el formulario. Se ve marcada de inmediato y vuelve atrás
 * si el servidor no lo guarda.
 */
export function CasillaIntersemestral({
  id,
  marcado,
  nombre,
  conTexto = false,
}: {
  id: string;
  marcado: boolean;
  nombre: string;
  conTexto?: boolean;
}) {
  const [optimista, setOptimista] = useOptimistic(marcado);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={optimista}
          disabled={guardando}
          aria-label={`Intersemestral: ${nombre}`}
          title="Marcar como intersemestral"
          onChange={(e) => {
            const valor = e.target.checked;
            setError(null);
            iniciar(async () => {
              setOptimista(valor);
              const respuesta = await marcarIntersemestral(id, valor);
              if (respuesta.error) setError(respuesta.error);
            });
          }}
          className="h-4 w-4 accent-primary disabled:opacity-50"
        />
        {conTexto && "Intersemestral"}
      </label>
      {error && (
        <span role="alert" className="max-w-[180px] text-[11px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
