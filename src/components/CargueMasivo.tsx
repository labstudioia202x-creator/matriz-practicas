"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  cargarPracticantes,
  CargaResult,
} from "@/app/(app)/practicantes/actions";

export default function CargueMasivo() {
  const [resultado, formAction, pending] = useActionState<
    CargaResult | undefined,
    FormData
  >(cargarPracticantes, undefined);

  const esExitoso =
    resultado && "creados" in resultado;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      {/* Paso 1: plantilla */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          1
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900">
          Descarga la plantilla
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          La plantilla tiene los encabezados exactos que el sistema espera,
          con listas desplegables y una fila de ejemplo. Diligencia una fila
          por estudiante y guarda el archivo en formato{" "}
          <strong>.xlsx</strong>.
        </p>
        <a
          href="/api/plantilla"
          className="mt-4 inline-block rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          ⬇ Descargar plantilla
        </a>
      </section>

      {/* Paso 2: subir archivo */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          2
        </div>
        <h2 className="mt-3 text-base font-bold text-slate-900">
          Sube tu archivo Excel
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Selecciona el <strong>.xlsx</strong> diligenciado. Antes de cargar:
          elimina la fila de ejemplo, revisa que la columna{" "}
          <strong>Práctica</strong> tenga el valor (Prácticas I, II o III) y
          que no queden filas vacías.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Archivo Excel (.xlsx) *
            </span>
            <input
              type="file"
              name="archivo"
              accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              className="block w-full rounded-lg border border-slate-300 text-sm text-slate-900 file:mr-3 file:rounded-l-lg file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-dark"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Procesando archivo…" : "⬆ Cargar practicantes"}
          </button>
        </form>
      </section>

      {/* Resultados */}
      {resultado && "error" in resultado && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 lg:col-span-2">
          <p className="font-semibold">No se pudo completar el cargue:</p>
          <p className="mt-1">{resultado.error}</p>
        </div>
      )}

      {esExitoso && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-800 lg:col-span-2">
          <p className="font-semibold">
            ✔ {resultado.creados}{" "}
            {resultado.creados === 1
              ? "practicante cargado"
              : "practicantes cargados"}{" "}
            correctamente.
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-3">
              <p className="font-semibold text-amber-700">
                Se ignoraron {resultado.errores.length}{" "}
                {resultado.errores.length === 1 ? "fila" : "filas"} con
                errores:
              </p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-amber-800">
                {resultado.errores.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-green-700">
                Corrige esas filas en el archivo y vuelve a cargarlo. Si una
                fila ya estaba registrada (mismo número de documento), se
                ignora para no duplicar.
              </p>
            </div>
          )}
          <Link
            href="/practicantes"
            className="mt-3 inline-block rounded-lg border border-green-700 px-4 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100"
          >
            Ver mis practicantes →
          </Link>
        </div>
      )}
    </div>
  );
}