"use client";

import { useActionState } from "react";
import { guardarCarpeta, ConfigState } from "@/app/(app)/configuracion/actions";

const estadoInicial: ConfigState = undefined;

export default function FormularioCarpeta({
  urlActual,
  nombreCarpeta,
  conectado,
}: {
  urlActual: string;
  nombreCarpeta: string;
  conectado: boolean;
}) {
  const [estado, accion, guardando] = useActionState(
    guardarCarpeta,
    estadoInicial
  );

  return (
    <form action={accion} className="mt-4">
      <label
        htmlFor="sharepoint_carpeta_url"
        className="block text-sm font-medium text-slate-700"
      >
        Enlace de la carpeta
      </label>
      <textarea
        id="sharepoint_carpeta_url"
        name="sharepoint_carpeta_url"
        defaultValue={urlActual}
        rows={3}
        placeholder="https://…sharepoint.com/personal/…/Documents/MI CARPETA"
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      />

      {nombreCarpeta && !estado?.ok && (
        <p className="mt-2 text-xs text-slate-500">
          Carpeta actual: <span className="font-medium">{nombreCarpeta}</span>
        </p>
      )}

      {estado?.error && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p className="mt-2 rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800">
          {estado.ok}
          {estado.carpeta ? ` Destino: ${estado.carpeta}.` : ""}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando || !conectado}
        className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
      >
        {guardando ? "Verificando…" : "Guardar y verificar carpeta"}
      </button>

      {!conectado && (
        <p className="mt-2 text-xs text-amber-700">
          Conecta primero tu cuenta de Microsoft para poder verificar la
          carpeta.
        </p>
      )}
    </form>
  );
}
