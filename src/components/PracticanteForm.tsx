"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  guardarPracticante,
  FormState,
} from "@/app/(app)/practicantes/actions";
import {
  PRACTICAS,
  PROGRAMAS_ACADEMICOS,
  SEMESTRES,
  MODALIDADES,
  ESTADOS,
} from "@/lib/constants";
import { Practicante } from "@/lib/types";

const initialState: FormState = undefined;

const inputClases =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";
const labelClases = "mb-1 block text-sm font-medium text-slate-700";

export default function PracticanteForm({
  practicante,
}: {
  practicante?: Practicante;
}) {
  const [state, formAction] = useActionState(guardarPracticante, initialState);

  const [estado, setEstado] = useState(practicante?.estado ?? "");
  const esReprobado = estado === "Reprobado";

  return (
    <form
      action={formAction}
      className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-8"
    >
      {practicante && (
        <input type="hidden" name="id" value={practicante.id} />
      )}

      {state?.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Datos del practicante
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="practica" className={labelClases}>
              Práctica *
            </label>
            <select
              id="practica"
              name="practica"
              required
              defaultValue={practicante?.practica ?? ""}
              className={inputClases}
            >
              <option value="">Seleccionar…</option>
              {PRACTICAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="nombre_completo" className={labelClases}>
              Nombre completo *
            </label>
            <input
              id="nombre_completo"
              name="nombre_completo"
              type="text"
              required
              defaultValue={practicante?.nombre_completo ?? ""}
              placeholder="Nombre y apellidos del estudiante"
              className={inputClases}
            />
          </div>

          <div>
            <label htmlFor="numero_documento" className={labelClases}>
              N° documento
            </label>
            <input
              id="numero_documento"
              name="numero_documento"
              type="text"
              defaultValue={practicante?.numero_documento ?? ""}
              placeholder="Cédula o documento"
              className={inputClases}
            />
          </div>

          <div>
            <label htmlFor="correo_electronico" className={labelClases}>
              Correo electrónico del estudiante
            </label>
            <input
              id="correo_electronico"
              name="correo_electronico"
              type="email"
              defaultValue={practicante?.correo_electronico ?? ""}
              placeholder="estudiante@correo.com"
              className={inputClases}
            />
          </div>

          <div>
            <label htmlFor="programa_academico" className={labelClases}>
              Programa académico
            </label>
            <select
              id="programa_academico"
              name="programa_academico"
              defaultValue={practicante?.programa_academico ?? ""}
              className={inputClases}
            >
              <option value="">Seleccionar…</option>
              {PROGRAMAS_ACADEMICOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="semestre" className={labelClases}>
              Semestre
            </label>
            <select
              id="semestre"
              name="semestre"
              defaultValue={practicante?.semestre?.toString() ?? ""}
              className={inputClases}
            >
              <option value="">Seleccionar…</option>
              {SEMESTRES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Información de vinculación
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="empresa" className={labelClases}>
              Empresa
            </label>
            <input
              id="empresa"
              name="empresa"
              type="text"
              defaultValue={practicante?.empresa ?? ""}
              placeholder="Nombre de la empresa"
              className={inputClases}
            />
          </div>

          <div>
            <label htmlFor="modalidad" className={labelClases}>
              Modalidad
            </label>
            <select
              id="modalidad"
              name="modalidad"
              defaultValue={practicante?.modalidad ?? ""}
              className={inputClases}
            >
              <option value="">Seleccionar…</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fecha_inicio" className={labelClases}>
              Fecha de inicio
            </label>
            <input
              id="fecha_inicio"
              name="fecha_inicio"
              type="date"
              defaultValue={practicante?.fecha_inicio ?? ""}
              className={inputClases}
            />
          </div>

          <div>
            <label htmlFor="fecha_fin" className={labelClases}>
              Fecha de fin
            </label>
            <input
              id="fecha_fin"
              name="fecha_fin"
              type="date"
              defaultValue={practicante?.fecha_fin ?? ""}
              className={inputClases}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="tutor_empresa" className={labelClases}>
              Tutor de empresa
            </label>
            <input
              id="tutor_empresa"
              name="tutor_empresa"
              type="text"
              defaultValue={practicante?.tutor_empresa ?? ""}
              placeholder="Nombre del tutor asignado por la empresa"
              className={inputClases}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
          Seguimiento
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="estado" className={labelClases}>
              Estado
            </label>
            <select
              id="estado"
              name="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={inputClases}
            >
              <option value="">Seleccionar…</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {esReprobado && (
            <div>
              <label
                htmlFor="motivo_reprobacion"
                className={labelClases}
              >
                Motivo de reprobación *
              </label>
              <input
                id="motivo_reprobacion"
                name="motivo_reprobacion"
                type="text"
                required
                defaultValue={practicante?.motivo_reprobacion ?? ""}
                placeholder="Explica el motivo de la reprobación"
                className={inputClases}
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <label htmlFor="observaciones" className={labelClases}>
              Observaciones
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              defaultValue={practicante?.observaciones ?? ""}
              placeholder="Notas adicionales del seguimiento"
              className={inputClases}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
        <button
          type="submit"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          {practicante ? "Guardar cambios" : "Registrar practicante"}
        </button>
        <Link
          href="/practicantes"
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}