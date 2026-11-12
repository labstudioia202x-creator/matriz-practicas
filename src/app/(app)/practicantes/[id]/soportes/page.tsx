import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Practicante, Soporte } from "@/lib/types";
import { sanitizarNombre } from "@/lib/microsoft/graph";
import PanelSoportes from "@/components/PanelSoportes";
import { AvanceBadge } from "@/components/IndicadoresPortal";
import CambiarAvance from "@/components/CambiarAvance";
import MarcaRecibido from "@/components/MarcaRecibido";
import {
  calcularCompletitud,
  estadoRequisito,
  PASOS_GUIA,
} from "@/lib/portal/guia";

export const dynamic = "force-dynamic";

export default async function SoportesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: practicante } = await supabase
    .from("practicantes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!practicante || practicante.docente_id !== user.id) {
    notFound();
  }

  const { data: soportes } = await supabase
    .from("soportes")
    .select("*")
    .eq("practicante_id", id)
    .order("subido_en", { ascending: false });

  const { data: perfil } = await supabase
    .from("profiles")
    .select(
      "microsoft_email, sharepoint_carpeta_nombre, sharepoint_item_id, flujo_configurado"
    )
    .eq("id", user.id)
    .maybeSingle();

  const p = practicante as Practicante;
  const viaFlujo = Boolean(perfil?.flujo_configurado);
  const destinoListo =
    viaFlujo || Boolean(perfil?.microsoft_email && perfil?.sharepoint_item_id);
  const carpetaEstudiante = sanitizarNombre(p.nombre_completo ?? "");
  const listaSoportes = (soportes ?? []) as Soporte[];
  const { datos, entregables } = calcularCompletitud(p, listaSoportes);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Soportes de {p.nombre_completo ?? "practicante"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {p.practica ?? "Sin práctica"} · Documento{" "}
            {p.numero_documento ?? "—"} · {p.empresa ?? "Sin empresa"}
          </p>
        </div>
        <Link
          href="/practicantes"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Volver
        </Link>
      </div>

      {/* Lo que el estudiante ha reportado desde su portal */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            Avance: <AvanceBadge avance={p.avance} />
          </span>
          <span>
            Datos {datos.hechos} de {datos.total}
          </span>
          <span>
            Entregables {entregables.hechos} de {entregables.total}
          </span>
          {p.avance_actualizado_en && (
            <span className="text-xs text-slate-500">
              Actualizado el{" "}
              {new Date(p.avance_actualizado_en).toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "America/Bogota",
              })}
            </span>
          )}
        </div>
        <div className="mt-2">
          <CambiarAvance practicanteId={p.id} avance={p.avance} />
          <p className="mt-1 text-xs text-slate-500">
            El estudiante lo reporta desde su portal; aquí puedes corregirlo. Él
            también podrá volver a cambiarlo. Si el estudiante te mandó un
            entregable por otro medio, márcalo como &quot;Recibido&quot;: cuenta como
            entregado.
          </p>
        </div>
        <div className="mt-3 grid gap-4 border-t border-slate-100 pt-3 md:grid-cols-3">
          {PASOS_GUIA.map((paso) => (
            <div key={paso.avance}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {paso.entrega} · {paso.avance}
              </h2>
              <ul className="mt-1 space-y-0.5 text-sm">
                {paso.requisitos.map((r) => {
                  const { cumplido, diligenciado, tieneArchivo, recibido } =
                    estadoRequisito(
                      r,
                      p.formularios_diligenciados,
                      listaSoportes,
                      p.requisitos_recibidos
                    );
                  // La casilla solo hace falta si no está cumplido por lo que
                  // entregó el estudiante, o si ya la marcaste (para desmarcar).
                  const cumplidoSinMarca = estadoRequisito(
                    r,
                    p.formularios_diligenciados,
                    listaSoportes
                  ).cumplido;
                  return (
                    <li
                      key={r.id}
                      className={cumplido ? "text-slate-900" : "text-slate-500"}
                    >
                      <span aria-hidden="true">{cumplido ? "✓ " : "○ "}</span>
                      {r.nombre}
                      <span className="sr-only">
                        {cumplido ? " (listo)" : " (pendiente)"}
                      </span>
                      {r.tipo === "formulario" && (
                        <span className="block pl-4 text-xs text-slate-500">
                          {diligenciado ? "Diligenciado" : "Sin diligenciar"} ·{" "}
                          {tieneArchivo ? "con evidencia" : "sin evidencia"}
                        </span>
                      )}
                      {(recibido || !cumplidoSinMarca) && (
                        <MarcaRecibido
                          practicanteId={p.id}
                          requisitoId={r.id}
                          nombre={r.nombre}
                          recibido={recibido}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Dónde van a quedar los archivos */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        {destinoListo ? (
          <p className="text-slate-600">
            Destino:{" "}
            {perfil?.sharepoint_carpeta_nombre && !viaFlujo && (
              <>
                <span className="font-medium text-slate-900">
                  {perfil.sharepoint_carpeta_nombre}
                </span>{" "}
                <span className="text-slate-400">/</span>{" "}
              </>
            )}
            <span className="font-medium text-slate-900">
              {carpetaEstudiante}
            </span>
            <span className="ml-2 text-xs text-slate-400">
              (la subcarpeta del estudiante se crea sola en la primera subida
              {viaFlujo ? ", dentro de la carpeta que definiste en tu flujo" : ""})
            </span>
          </p>
        ) : (
          <p className="text-amber-800">
            Aún no puedes subir soportes:{" "}
            <Link
              href="/configuracion"
              className="font-semibold underline underline-offset-2"
            >
              conecta tu cuenta de Microsoft e indica la carpeta de destino
            </Link>
            .
          </p>
        )}
      </div>

      <PanelSoportes
        practicanteId={p.id}
        soportes={listaSoportes}
        habilitado={destinoListo}
      />
    </div>
  );
}
