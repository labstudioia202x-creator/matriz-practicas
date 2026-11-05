"use client";

import {
  startTransition,
  useActionState,
  useOptimistic,
  useState,
} from "react";
import { AVANCES, TAMANO_MAXIMO_PORTAL_MB } from "@/lib/constants";
import {
  estadoRequisito,
  PASO_CON_REQUISITOS_OBLIGATORIOS,
  PASOS_GUIA,
  RequisitoGuia,
  requisitosPendientes,
} from "@/lib/portal/guia";
import {
  marcarAvance,
  marcarFormulario,
  PortalState,
  subirDocumento,
} from "@/app/(estudiante)/mi-practica/actions";

export type DocumentoEntregado = {
  id: string;
  tipo_documento: string;
  nombre_archivo: string;
  fecha: string;
};

const estadoInicial: PortalState = undefined;

export default function GuiaPasos({
  practicanteId,
  avance,
  documentos,
  formularios,
  datosCompletos,
}: {
  practicanteId: string;
  avance: string | null;
  documentos: DocumentoEntregado[];
  formularios: string[];
  datosCompletos: boolean;
}) {
  const [estado, accion, guardando] = useActionState(marcarAvance, estadoInicial);
  const indiceActual = AVANCES.indexOf(avance as (typeof AVANCES)[number]);

  return (
    <section aria-labelledby="titulo-guia" className="mt-8">
      <h2 id="titulo-guia" className="text-lg font-bold text-slate-900">
        Tu guía paso a paso
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Indica en qué paso vas y completa lo que se pide en cada entrega.
      </p>

      {estado?.error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado?.ok && (
        <p role="status" className="mt-3 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          {estado.ok}
        </p>
      )}

      <ol className="mt-4 space-y-4">
        {PASOS_GUIA.map((paso, i) => {
          const esActual = i === indiceActual;
          const superado = i < indiceActual;
          const pendientes = requisitosPendientes(
            paso.avance,
            formularios,
            documentos
          );
          const esObligatorio =
            paso.avance === PASO_CON_REQUISITOS_OBLIGATORIOS;
          const bloqueado = esObligatorio && pendientes.length > 0;

          return (
            <li
              key={paso.avance}
              aria-current={esActual ? "step" : undefined}
              className={`rounded-xl border bg-white p-4 sm:p-5 ${
                esActual ? "border-primary ring-1 ring-primary" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      esActual
                        ? "bg-primary text-white"
                        : superado
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {superado ? "✓" : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {paso.entrega}
                    </p>
                    <h3 className="font-semibold text-slate-900">{paso.avance}</h3>
                  </div>
                </div>

                {esActual ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Estás aquí
                  </span>
                ) : (
                  <form action={accion}>
                    <input type="hidden" name="practicante_id" value={practicanteId} />
                    <input type="hidden" name="avance" value={paso.avance} />
                    <button
                      type="submit"
                      disabled={guardando || bloqueado}
                      className="rounded-lg border border-primary px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-transparent"
                    >
                      {esObligatorio
                        ? "Marcar práctica finalizada"
                        : "Estoy en este paso"}
                    </button>
                  </form>
                )}
              </div>

              <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-slate-600 sm:ml-11">
                {paso.actividades.map((actividad) => (
                  <li key={actividad}>{actividad}</li>
                ))}
              </ul>

              {i === 0 && (
                <p className="mt-2 text-sm sm:ml-11">
                  <a
                    href="#mis-datos"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {datosCompletos
                      ? "Tus datos están completos"
                      : "Completar mis datos"}
                  </a>
                </p>
              )}

              <div className="mt-3 sm:ml-11">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Qué entregar ·{" "}
                  {pendientes.length === 0
                    ? "todo listo"
                    : `${pendientes.length} pendiente${pendientes.length === 1 ? "" : "s"}`}
                </p>
                <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {paso.requisitos.map((requisito) => (
                    <FilaRequisito
                      key={requisito.id}
                      practicanteId={practicanteId}
                      requisito={requisito}
                      formularios={formularios}
                      documentos={documentos}
                    />
                  ))}
                </ul>

                {bloqueado && !esActual && (
                  <p className="mt-2 text-sm text-amber-800">
                    Todo es obligatorio para marcar la práctica como finalizada.
                    Te falta: {pendientes.map((r) => r.nombre).join(", ")}.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function FilaRequisito({
  practicanteId,
  requisito,
  formularios,
  documentos,
}: {
  practicanteId: string;
  requisito: RequisitoGuia;
  formularios: string[];
  documentos: DocumentoEntregado[];
}) {
  const { cumplido, diligenciado } = estadoRequisito(
    requisito,
    formularios,
    documentos
  );
  const ultimo = documentos.find((d) => d.tipo_documento === requisito.id);
  const esFormulario = requisito.tipo === "formulario";

  return (
    <li className="p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 sm:max-w-md">
          <p className="text-sm font-medium text-slate-900">
            <span
              aria-hidden="true"
              className={cumplido ? "text-green-700" : "text-slate-400"}
            >
              {cumplido ? "✓ " : "○ "}
            </span>
            {requisito.nombre}
            <span className="sr-only">
              {cumplido ? " (listo)" : " (pendiente)"}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">{requisito.ayuda}</p>
          {ultimo && (
            <p className="mt-0.5 break-words text-xs text-slate-700">
              Entregado: {ultimo.nombre_archivo} · {ultimo.fecha}
            </p>
          )}
          {esFormulario && (
            <CheckFormulario
              practicanteId={practicanteId}
              formularioId={requisito.id}
              diligenciado={diligenciado}
            />
          )}
        </div>

        <SubirArchivo
          practicanteId={practicanteId}
          requisito={requisito}
          hayArchivo={Boolean(ultimo)}
        />
      </div>
    </li>
  );
}

function CheckFormulario({
  practicanteId,
  formularioId,
  diligenciado,
}: {
  practicanteId: string;
  formularioId: string;
  diligenciado: boolean;
}) {
  const [estado, accion, guardando] = useActionState(
    marcarFormulario,
    estadoInicial
  );
  // Se marca al instante; si el servidor lo rechaza, vuelve solo a su valor real.
  const [marcado, setMarcado] = useOptimistic(diligenciado);

  return (
    <div className="mt-2">
      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          type="checkbox"
          checked={marcado}
          disabled={guardando}
          onChange={(e) => {
            const valor = e.target.checked;
            const datos = new FormData();
            datos.set("practicante_id", practicanteId);
            datos.set("formulario", formularioId);
            datos.set("marcado", String(valor));
            startTransition(() => {
              setMarcado(valor);
              accion(datos);
            });
          }}
          className="h-4 w-4 accent-primary"
        />
        {guardando ? "Guardando…" : "Ya diligencié este formulario"}
      </label>
      {estado?.error && (
        <p role="alert" className="mt-1 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {estado.error}
        </p>
      )}
    </div>
  );
}

function SubirArchivo({
  practicanteId,
  requisito,
  hayArchivo,
}: {
  practicanteId: string;
  requisito: RequisitoGuia;
  hayArchivo: boolean;
}) {
  const [estado, accion, subiendo] = useActionState(subirDocumento, estadoInicial);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const error = errorLocal ?? estado?.error;

  const soloPdf = requisito.tipo === "documento" && requisito.soloPdf;

  return (
    <div className="w-full sm:w-auto sm:max-w-[300px]">
      {requisito.tipo === "formulario" && (
        <p className="mb-1 text-xs font-medium text-slate-600">
          Evidencia{" "}
          {requisito.evidenciaObligatoria ? "(obligatoria)" : "(opcional)"}
        </p>
      )}
      <form
        action={accion}
        onSubmit={(e) => {
          const archivo = new FormData(e.currentTarget).get("archivo");
          if (
            archivo instanceof File &&
            archivo.size > TAMANO_MAXIMO_PORTAL_MB * 1024 * 1024
          ) {
            e.preventDefault();
            setErrorLocal(
              `El archivo pesa más de ${TAMANO_MAXIMO_PORTAL_MB} MB. Comprímelo o guárdalo en menor calidad.`
            );
            return;
          }
          setErrorLocal(null);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="practicante_id" value={practicanteId} />
        <input type="hidden" name="tipo_documento" value={requisito.id} />
        <input
          type="file"
          name="archivo"
          required
          disabled={subiendo}
          aria-label={`Archivo de ${requisito.nombre}`}
          accept={
            soloPdf
              ? ".pdf"
              : ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"
          }
          className="max-w-[210px] text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
        />
        <button
          type="submit"
          disabled={subiendo}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {subiendo ? "Subiendo…" : hayArchivo ? "Subir otra versión" : "Subir"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {estado?.ok && !error && (
        <p role="status" className="mt-2 text-xs font-medium text-green-800">
          {estado.ok}
        </p>
      )}
    </div>
  );
}
