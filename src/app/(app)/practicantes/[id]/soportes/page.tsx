import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Practicante, Soporte } from "@/lib/types";
import { sanitizarNombre } from "@/lib/microsoft/graph";
import PanelSoportes from "@/components/PanelSoportes";

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
        soportes={(soportes ?? []) as Soporte[]}
        habilitado={destinoListo}
      />
    </div>
  );
}
