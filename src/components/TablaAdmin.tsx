"use client";

import { useMemo, useState } from "react";
import { PracticanteConDocente } from "@/lib/types";

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

export default function TablaAdmin({
  practicantes,
  estados,
}: {
  practicantes: PracticanteConDocente[];
  estados: readonly string[];
}) {
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return practicantes.filter((p) => {
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (!texto) return true;
      return [p.nombre_completo, p.numero_documento, p.empresa, p.practica, p.docente?.full_name, p.docente?.email]
        .some((v) => v?.toLowerCase().includes(texto));
    });
  }, [practicantes, filtroEstado, busqueda]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, documento, empresa o docente…"
          className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Todos los estados</option>
          {estados.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      {/* Escritorio */}
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">N°</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Práctica</th>
              <th className="px-4 py-3 font-semibold">Documento</th>
              <th className="px-4 py-3 font-semibold">Programa</th>
              <th className="px-4 py-3 font-semibold">Sem.</th>
              <th className="px-4 py-3 font-semibold">Empresa</th>
              <th className="px-4 py-3 font-semibold">Modalidad</th>
              <th className="px-4 py-3 font-semibold">Inicio – Fin</th>
              <th className="px-4 py-3 font-semibold">Tutor empresa</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Docente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtrados.map((p, i) => (
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
                <td className="max-w-[200px] px-4 py-3 text-slate-600">
                  {p.programa_academico ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.semestre ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.empresa ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {p.modalidad ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {p.fecha_inicio ?? "—"} → {p.fecha_fin ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.tutor_empresa ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      coloresBadge[p.estado ?? ""] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.estado ?? "—"}
                  </span>
                  {p.estado === "Reprobado" && p.motivo_reprobacion && (
                    <p className="mt-1 max-w-[160px] text-xs text-slate-500">
                      {p.motivo_reprobacion}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {p.docente?.full_name || p.docente?.email || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil / tablet: tarjetas */}
      <div className="space-y-3 lg:hidden">
        {filtrados.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No se encontraron resultados con los filtros actuales.
          </p>
        )}
        {filtrados.map((p, i) => (
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
                <dt className="text-slate-400">Inicio – Fin:</dt>
                <dd>
                  {p.fecha_inicio ?? "—"} → {p.fecha_fin ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Tutor empresa:</dt>
                <dd>{p.tutor_empresa ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Docente:</dt>
                <dd>{p.docente?.full_name || p.docente?.email || "—"}</dd>
              </div>
              {p.estado === "Reprobado" && p.motivo_reprobacion && (
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
          </div>
        ))}
      </div>
    </div>
  );
}