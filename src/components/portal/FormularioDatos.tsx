"use client";

import { startTransition, useActionState } from "react";
import { MODALIDADES, PROGRAMAS_ACADEMICOS, SEMESTRES } from "@/lib/constants";
import { CAMPOS_ESTUDIANTE, CampoEstudiante } from "@/lib/portal/guia";
import type { PracticaPortal } from "@/lib/portal/sesion";
import {
  guardarDatos,
  PortalState,
} from "@/app/(estudiante)/mi-practica/actions";

const estadoInicial: PortalState = undefined;

const inputClases =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

const OPCIONES: Partial<Record<CampoEstudiante, readonly string[]>> = {
  programa_academico: PROGRAMAS_ACADEMICOS,
  semestre: SEMESTRES,
  modalidad: MODALIDADES,
};

export default function FormularioDatos({
  practica,
}: {
  practica: PracticaPortal;
}) {
  const [estado, accion, guardando] = useActionState(guardarDatos, estadoInicial);

  const faltantes = CAMPOS_ESTUDIANTE.filter(
    ({ campo }) => practica[campo] === null
  );
  const diligenciados = CAMPOS_ESTUDIANTE.filter(
    ({ campo }) => practica[campo] !== null
  );

  return (
    <section
      id="mis-datos"
      aria-labelledby="titulo-datos"
      className="mt-8 scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 id="titulo-datos" className="text-lg font-bold text-slate-900">
        Mis datos
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {faltantes.length > 0
          ? "Completa lo que falta. Una vez guardado, solo tu docente puede corregirlo."
          : "Tus datos están completos. Si algo está mal, pídele a tu docente que lo corrija."}
      </p>

      {faltantes.length > 0 && (
        // Se envía con onSubmit porque <form action> vacía el formulario al
        // terminar, y el estudiante perdería lo escrito si hay un error.
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const datos = new FormData(e.currentTarget);
            startTransition(() => accion(datos));
          }}
          className="mt-4"
        >
          <input type="hidden" name="practicante_id" value={practica.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            {faltantes.map(({ campo, etiqueta }) => (
              <div key={campo}>
                <label
                  htmlFor={campo}
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  {etiqueta}
                </label>
                <CampoEntrada campo={campo} />
              </div>
            ))}
          </div>

          {estado?.error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {estado.error}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Guardar mis datos"}
          </button>
        </form>
      )}

      {estado?.ok && (
        <p role="status" className="mt-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {estado.ok}
        </p>
      )}

      <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
        <Dato etiqueta="Nombre" valor={practica.nombre_completo} />
        <Dato etiqueta="Correo" valor={practica.correo_electronico} />
        <Dato etiqueta="Práctica" valor={practica.practica} />
        {diligenciados.map(({ campo, etiqueta }) => (
          <Dato key={campo} etiqueta={etiqueta} valor={practica[campo]} />
        ))}
      </dl>
    </section>
  );
}

function CampoEntrada({ campo }: { campo: CampoEstudiante }) {
  const opciones = OPCIONES[campo];

  if (opciones) {
    return (
      <select id={campo} name={campo} defaultValue="" className={inputClases}>
        <option value="">Seleccionar…</option>
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={campo}
      name={campo}
      type={campo.startsWith("fecha_") ? "date" : "text"}
      maxLength={200}
      className={inputClases}
    />
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | number | null;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="break-words font-medium text-slate-900">{valor ?? "—"}</dd>
    </div>
  );
}
