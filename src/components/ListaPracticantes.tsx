"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Practicante } from "@/lib/types";
import { PRACTICAS, ESTADOS } from "@/lib/constants";
import { eliminarPracticante, FormState } from "@/app/(app)/practicantes/actions";

const coloresBadge: Record<string, string> = {
  Aprobado: "bg-green-100 text-green-800",
  Vinculado: "bg-blue-100 text-blue-800",
  "No Iniciado": "bg-slate-100 text-slate-600",
  Reprobado: "bg-red-100 text-red-700",
  Ausente: "bg-amber-100 text-amber-800",
  "No vinculado": "bg-slate-200 text-slate-700",
};

const coloresPractica: Record<string, string> = {
  "Prácticas I": "bg-purple-100 text-purple-800",
  "Prácticas II": "bg-teal-100 text-teal-800",
  "Prácticas III": "bg-indigo-100 text-indigo-800",
};

const initialState: FormState = undefined;

type CampoOrden =
  | "nombre_completo"
  | "practica"
  | "numero_documento"
  | "programa_academico"
  | "semestre"
  | "empresa"
  | "modalidad"
  | "estado";

type Orden = { campo: CampoOrden; dir: "asc" | "desc" };

const COLUMNAS: { campo: CampoOrden; etiqueta: string }[] = [
  { campo: "nombre_completo", etiqueta: "Nombre" },
  { campo: "practica", etiqueta: "Práctica" },
  { campo: "numero_documento", etiqueta: "Documento" },
  { campo: "programa_academico", etiqueta: "Programa" },
  { campo: "semestre", etiqueta: "Sem." },
  { campo: "empresa", etiqueta: "Empresa" },
  { campo: "modalidad", etiqueta: "Modalidad" },
  { campo: "estado", etiqueta: "Estado" },
];

function esVacio(p: Practicante, campo: CampoOrden) {
  const v = p[campo];
  return v === null || v === undefined || v === "";
}

function comparar(a: Practicante, b: Practicante, campo: CampoOrden) {
  if (campo === "semestre") {
    return (a.semestre ?? 0) - (b.semestre ?? 0);
  }
  return String(a[campo] ?? "").localeCompare(String(b[campo] ?? ""), "es", {
    sensitivity: "base",
    numeric: true,
  });
}

export default function ListaPracticantes({
  practicantes,
}: {
  practicantes: Practicante[];
}) {
  const [deleteState, deleteAction, deleting] = useActionState(
    eliminarPracticante,
    initialState
  );

  const [busqueda, setBusqueda] = useState("");
  const [filtroPractica, setFiltroPractica] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [orden, setOrden] = useState<Orden | null>(null);

  // Clic en el encabezado: ascendente → descendente → sin orden
  function alternarOrden(campo: CampoOrden) {
    setOrden((actual) => {
      if (actual?.campo !== campo) return { campo, dir: "asc" };
      if (actual.dir === "asc") return { campo, dir: "desc" };
      return null;
    });
  }

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return practicantes.filter((p) => {
      if (filtroPractica && p.practica !== filtroPractica) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (!texto) return true;
      return [
        p.nombre_completo,
        p.numero_documento,
        p.empresa,
        p.correo_electronico,
        p.tutor_empresa,
      ].some((v) => v?.toLowerCase().includes(texto));
    });
  }, [practicantes, busqueda, filtroPractica, filtroEstado]);

  const ordenados = useMemo(() => {
    if (!orden) return filtrados;
    const factor = orden.dir === "asc" ? 1 : -1;
    // Los registros sin dato quedan al final en ambas direcciones
    return [...filtrados].sort((a, b) => {
      const vacioA = esVacio(a, orden.campo);
      const vacioB = esVacio(b, orden.campo);
      if (vacioA && vacioB) return 0;
      if (vacioA) return 1;
      if (vacioB) return -1;
      return factor * comparar(a, b, orden.campo);
    });
  }, [filtrados, orden]);

  return (
    <div>
      {deleteState?.error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {deleteState.error}
        </div>
      )}

      {/* Barra de filtros */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, documento, empresa, correo…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={filtroPractica}
          onChange={(e) => setFiltroPractica(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Todas las prácticas</option>
          {PRACTICAS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-4xl">🔍</p>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">
            No se encontraron practicantes
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Ajusta el buscador o los filtros de práctica y estado.
          </p>
        </div>
      ) : (
        <p className="mb-2 text-xs text-slate-400">
          Mostrando {filtrados.length} de {practicantes.length} practicantes
        </p>
      )}

      {filtrados.length > 0 && (
        <>
      {/* Vista escritorio */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">N°</th>
              {COLUMNAS.map(({ campo, etiqueta }) => {
                const dir = orden?.campo === campo ? orden.dir : null;
                return (
                  <th
                    key={campo}
                    scope="col"
                    aria-sort={
                      dir === "asc"
                        ? "ascending"
                        : dir === "desc"
                          ? "descending"
                          : "none"
                    }
                    className="px-4 py-3 font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => alternarOrden(campo)}
                      title={`Ordenar por ${etiqueta}`}
                      className="flex items-center gap-1 font-semibold transition hover:text-white/75"
                    >
                      {etiqueta}
                      <span
                        aria-hidden="true"
                        className={`text-[10px] ${dir ? "text-white" : "text-white/40"}`}
                      >
                        {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "⇅"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenados.map((p, i) => (
              <tr key={p.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {p.nombre_completo ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      coloresPractica[p.practica ?? ""] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.practica ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.numero_documento ?? "—"}
                </td>
                <td className="max-w-[220px] px-4 py-3 text-slate-600">
                  {p.programa_academico ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.semestre ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.empresa ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.modalidad ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      coloresBadge[p.estado ?? ""] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.estado ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/practicantes/${p.id}/editar`}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Editar
                    </Link>
                    <Link
                      href={`/practicantes/${p.id}/soportes`}
                      className="rounded-md border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary transition hover:bg-primary/5"
                    >
                      Soportes
                    </Link>
                    <form action={deleteAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        disabled={deleting}
                        onClick={(e) => {
                          if (
                            !confirm(
                              `¿Eliminar a ${p.nombre_completo ?? "este practicante"}?`
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vista móvil: tarjetas */}
      <div className="space-y-3 md:hidden">
        {ordenados.map((p, i) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {i + 1}. {p.nombre_completo ?? "Sin nombre"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.practica ?? "Sin práctica"} ·{" "}
                  {p.programa_academico ?? "Sin programa"} · Sem.{" "}
                  {p.semestre ?? "-"}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  coloresBadge[p.estado ?? ""] ??
                  "bg-slate-100 text-slate-600"
                }`}
              >
                {p.estado ?? "—"}
              </span>
            </div>

            <dl className="mt-3 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Documento:</dt>
                <dd>{p.numero_documento ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Empresa:</dt>
                <dd>{p.empresa ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Modalidad:</dt>
                <dd>{p.modalidad ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Fecha inicio - fin:</dt>
                <dd>
                  {p.fecha_inicio ?? "—"} → {p.fecha_fin ?? "—"}
                </dd>
              </div>
              {p.motivo_reprobacion && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Motivo reprobación:</dt>
                  <dd>{p.motivo_reprobacion}</dd>
                </div>
              )}
              {p.observaciones && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-400">Observaciones:</dt>
                  <dd>{p.observaciones}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <Link
                href={`/practicantes/${p.id}/editar`}
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-center text-xs font-medium text-slate-700"
              >
                Editar
              </Link>
              <Link
                href={`/practicantes/${p.id}/soportes`}
                className="flex-1 rounded-md border border-primary/40 px-3 py-1.5 text-center text-xs font-medium text-primary"
              >
                Soportes
              </Link>
              <form
                action={deleteAction}
                className="flex-1"
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `¿Eliminar a ${p.nombre_completo ?? "este practicante"}?`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="id" value={p.id} />
                <button
                  type="submit"
                  disabled={deleting}
                  className="w-full rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-400">
        Los valores de los campos siguen las mismas listas de validación de la
        matriz de Excel.
      </p>
    </div>
  );
}