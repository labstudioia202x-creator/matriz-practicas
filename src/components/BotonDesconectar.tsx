"use client";

import { desconectarMicrosoft } from "@/app/(app)/configuracion/actions";

export default function BotonDesconectar() {
  return (
    <form action={desconectarMicrosoft}>
      <button
        type="submit"
        onClick={(e) => {
          if (
            !confirm(
              "¿Desconectar tu cuenta de Microsoft? Dejarás de poder subir soportes hasta que la vuelvas a conectar. Los archivos ya subidos permanecen en SharePoint."
            )
          ) {
            e.preventDefault();
          }
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Desconectar
      </button>
    </form>
  );
}
