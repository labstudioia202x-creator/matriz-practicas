"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  marcarPracticante,
  MarcaPracticante,
} from "@/app/(app)/practicantes/actions";

/** Etiqueta para los practicantes que siguen en el intersemestral. */
export function EtiquetaIntersemestral() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
      Intersemestral
    </span>
  );
}

/** Etiqueta para los registros de prueba, que no cuentan en los totales. */
export function EtiquetaPrueba() {
  return (
    <span
      title="Registro de prueba: no cuenta en los totales ni sale en el Excel"
      className="inline-block whitespace-nowrap rounded-full border border-dashed border-slate-400 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
    >
      Prueba
    </span>
  );
}

const TEXTOS: Record<MarcaPracticante, { etiqueta: string; ayuda: string }> = {
  intersemestral: {
    etiqueta: "Intersemestral",
    ayuda: "Marcar como intersemestral",
  },
  prueba: {
    etiqueta: "Prueba",
    ayuda: "Registro de prueba: no cuenta en los totales ni sale en el Excel",
  },
};

/**
 * Casilla para marcar o desmarcar al practicante (intersemestral o de prueba)
 * desde la lista, sin abrir el formulario. Se ve marcada de inmediato y vuelve
 * atrás si el servidor no lo guarda.
 */
export function CasillaMarca({
  id,
  marca,
  marcado,
  nombre,
  conTexto = false,
}: {
  id: string;
  marca: MarcaPracticante;
  marcado: boolean;
  nombre: string;
  conTexto?: boolean;
}) {
  const [optimista, setOptimista] = useOptimistic(marcado);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { etiqueta, ayuda } = TEXTOS[marca];

  return (
    <span className="inline-flex flex-col gap-1">
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-700">
        <input
          type="checkbox"
          checked={optimista}
          disabled={guardando}
          aria-label={`${etiqueta}: ${nombre}`}
          title={ayuda}
          onChange={(e) => {
            const valor = e.target.checked;
            setError(null);
            iniciar(async () => {
              setOptimista(valor);
              const respuesta = await marcarPracticante(id, marca, valor);
              if (respuesta.error) setError(respuesta.error);
            });
          }}
          className="h-4 w-4 accent-primary disabled:opacity-50"
        />
        {conTexto && etiqueta}
      </label>
      {error && (
        <span role="alert" className="max-w-[180px] text-[11px] text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
