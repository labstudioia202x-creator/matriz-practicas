"use client";

import { useActionState, useRef } from "react";
import { Soporte } from "@/lib/types";
import { TAMANO_MAXIMO_SOPORTE_MB } from "@/lib/constants";
import {
  subirSoporte,
  eliminarSoporte,
  SoporteState,
} from "@/app/(app)/practicantes/[id]/soportes/actions";

const estadoInicial: SoporteState = undefined;

function tamanoLegible(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PanelSoportes({
  practicanteId,
  soportes,
  habilitado,
}: {
  practicanteId: string;
  soportes: Soporte[];
  habilitado: boolean;
}) {
  const [estadoSubida, accionSubir, subiendo] = useActionState(
    subirSoporte,
    estadoInicial
  );
  const [estadoBorrado, accionBorrar, borrando] = useActionState(
    eliminarSoporte,
    estadoInicial
  );
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="mt-4">
      {/* Formulario de subida */}
      <form
        ref={formRef}
        action={async (formData) => {
          await accionSubir(formData);
          formRef.current?.reset();
        }}
        className="rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 className="font-semibold text-slate-900">Subir soporte</h2>
        <input type="hidden" name="practicante_id" value={practicanteId} />

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="archivo"
              className="block text-sm font-medium text-slate-700"
            >
              Archivo
            </label>
            <input
              id="archivo"
              name="archivo"
              type="file"
              required
              disabled={!habilitado || subiendo}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-slate-400">
              Máximo {TAMANO_MAXIMO_SOPORTE_MB} MB por archivo.
            </p>
          </div>

          <div>
            <label
              htmlFor="descripcion"
              className="block text-sm font-medium text-slate-700"
            >
              Descripción <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="descripcion"
              name="descripcion"
              type="text"
              maxLength={200}
              disabled={!habilitado || subiendo}
              placeholder="Ej: Carta de presentación firmada"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
            />
          </div>
        </div>

        {estadoSubida?.error && (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {estadoSubida.error}
          </p>
        )}
        {estadoSubida?.ok && (
          <p className="mt-3 rounded-lg border border-green-300 bg-green-50 p-2 text-sm text-green-800">
            {estadoSubida.ok}
          </p>
        )}

        <button
          type="submit"
          disabled={!habilitado || subiendo}
          className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {subiendo ? "Subiendo…" : "⬆ Subir soporte"}
        </button>
      </form>

      {estadoBorrado?.error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {estadoBorrado.error}
        </p>
      )}
      {estadoBorrado?.ok && (
        <p className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm text-slate-700">
          {estadoBorrado.ok}
        </p>
      )}

      {/* Archivos ya subidos */}
      <h2 className="mt-8 font-semibold text-slate-900">
        Archivos subidos{" "}
        <span className="text-sm font-normal text-slate-400">
          ({soportes.length})
        </span>
      </h2>

      {soportes.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-3xl">📎</p>
          <p className="mt-2 text-sm text-slate-500">
            Este practicante aún no tiene soportes cargados.
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {soportes.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                {s.web_url ? (
                  <a
                    href={s.web_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary hover:underline"
                  >
                    {s.nombre_archivo}
                  </a>
                ) : (
                  <span className="font-medium text-slate-900">
                    {s.nombre_archivo}
                  </span>
                )}
                <p className="mt-0.5 text-xs text-slate-500">
                  {s.descripcion ? `${s.descripcion} · ` : ""}
                  {tamanoLegible(s.tamano_bytes)} ·{" "}
                  {fechaLegible(s.subido_en)}
                </p>
              </div>

              <form action={accionBorrar}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  disabled={borrando}
                  onClick={(e) => {
                    if (
                      !confirm(
                        s.destino === "power_automate"
                          ? `¿Quitar "${s.nombre_archivo}" de la lista? El archivo seguirá en tu OneDrive.`
                          : `¿Eliminar "${s.nombre_archivo}"? También se borrará de la carpeta en la nube.`
                      )
                    ) {
                      e.preventDefault();
                    }
                  }}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
