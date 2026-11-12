"use client";

import { useOptimistic, useState, useTransition } from "react";
import { marcarRecibido } from "@/app/(app)/practicantes/[id]/soportes/actions";

/**
 * Casilla con la que el docente marca un entregable como recibido (p. ej. si el
 * estudiante se lo mandó por correo). Se ve marcada de inmediato y vuelve atrás
 * si el servidor no lo guarda.
 */
export default function MarcaRecibido({
  practicanteId,
  requisitoId,
  nombre,
  recibido,
}: {
  practicanteId: string;
  requisitoId: string;
  nombre: string;
  recibido: boolean;
}) {
  const [optimista, setOptimista] = useOptimistic(recibido);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="block pl-4">
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={optimista}
          disabled={guardando}
          aria-label={`Recibido: ${nombre}`}
          onChange={(e) => {
            const valor = e.target.checked;
            setError(null);
            iniciar(async () => {
              setOptimista(valor);
              const respuesta = await marcarRecibido(
                practicanteId,
                requisitoId,
                valor
              );
              if (respuesta.error) setError(respuesta.error);
            });
          }}
          className="h-3.5 w-3.5 accent-primary disabled:opacity-50"
        />
        {guardando ? "Guardando…" : "Recibido"}
      </label>
      {error && (
        <span role="alert" className="block text-[11px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
