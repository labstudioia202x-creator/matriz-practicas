"use client";

import { useActionState } from "react";
import {
  guardarFlujo,
  quitarFlujo,
  guardarFlujoComunicaciones,
  quitarFlujoComunicaciones,
  ConfigState,
} from "@/app/(app)/configuracion/actions";

const estadoInicial: ConfigState = undefined;

const TIPOS = {
  soportes: {
    guardar: guardarFlujo,
    quitar: quitarFlujo,
    alcance: "escribir en tu OneDrive",
    confirmarQuitar:
      "¿Quitar el flujo? Dejarás de poder subir soportes hasta que configures otro destino.",
  },
  comunicaciones: {
    guardar: guardarFlujoComunicaciones,
    quitar: quitarFlujoComunicaciones,
    alcance: "enviar mensajes de Teams y correos a tu nombre",
    confirmarQuitar:
      "¿Quitar el flujo? Dejarás de poder enviar comunicaciones hasta que configures otro.",
  },
};

export default function FormularioFlujo({
  configurado,
  tipo = "soportes",
}: {
  configurado: boolean;
  tipo?: keyof typeof TIPOS;
}) {
  const config = TIPOS[tipo];
  const idCampo = `url_flujo_${tipo}`;
  const [estado, accion, guardando] = useActionState(
    config.guardar,
    estadoInicial
  );

  return (
    <div className="mt-4">
      <form action={accion}>
        <label
          htmlFor={idCampo}
          className="block text-sm font-medium text-slate-700"
        >
          URL HTTP POST del disparador
        </label>
        <textarea
          id={idCampo}
          name="url_flujo"
          rows={3}
          placeholder="https://…/triggers/manual/paths/invoke?api-version=1&sp=…&sig=…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <p className="mt-1 text-xs text-slate-400">
          Esta dirección permite {config.alcance}: trátala como una
          contraseña. Se guarda en el servidor, en una tabla que el navegador no
          puede consultar, y nunca se muestra de vuelta.
        </p>

        {estado?.error && (
          <p className="mt-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {estado.error}
          </p>
        )}
        {estado?.ok && (
          <p className="mt-2 rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800">
            {estado.ok}
          </p>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="mt-3 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {guardando ? "Guardando…" : configurado ? "Reemplazar URL" : "Guardar flujo"}
        </button>
      </form>

      {configurado && (
        <form action={config.quitar} className="mt-3">
          <button
            type="submit"
            onClick={(e) => {
              if (
                !confirm(config.confirmarQuitar)
              ) {
                e.preventDefault();
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Quitar flujo
          </button>
        </form>
      )}
    </div>
  );
}
