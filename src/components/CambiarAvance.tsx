"use client";

import { useActionState, useState } from "react";
import { AVANCES } from "@/lib/constants";
import {
  cambiarAvance,
  SoporteState,
} from "@/app/(app)/practicantes/[id]/soportes/actions";

const estadoInicial: SoporteState = undefined;

/** Selector con el que el docente corrige el avance que reportó el estudiante. */
export default function CambiarAvance({
  practicanteId,
  avance,
}: {
  practicanteId: string;
  avance: string | null;
}) {
  const [estado, accion, guardando] = useActionState(cambiarAvance, estadoInicial);
  const [valor, setValor] = useState(avance ?? "");

  return (
    <form action={accion} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="practicante_id" value={practicanteId} />
      <label htmlFor="cambiar-avance" className="text-xs text-slate-500">
        Cambiar a
      </label>
      <select
        id="cambiar-avance"
        name="avance"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={guardando}
        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-primary"
      >
        <option value="">Sin reportar</option>
        {AVANCES.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={guardando || valor === (avance ?? "")}
        className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      {estado?.error && (
        <span role="alert" className="text-xs text-red-700">
          {estado.error}
        </span>
      )}
      {estado?.ok && !guardando && (
        <span role="status" className="text-xs font-medium text-green-800">
          {estado.ok}
        </span>
      )}
    </form>
  );
}
