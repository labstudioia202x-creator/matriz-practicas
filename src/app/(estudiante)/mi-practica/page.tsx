import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calcularCompletitud,
  etiquetaSoporte,
  REQUISITOS_GUIA,
} from "@/lib/portal/guia";
import { correoDeLaSesion, practicasDelCorreo } from "@/lib/portal/sesion";
import { createClient } from "@/lib/supabase/server";
import FormularioDatos from "@/components/portal/FormularioDatos";
import GuiaPasos, { DocumentoEntregado } from "@/components/portal/GuiaPasos";

export const dynamic = "force-dynamic";

export default async function MiPracticaPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const correo = await correoDeLaSesion();
  if (!correo) redirect("/acceso-estudiante");

  const practicas = await practicasDelCorreo(correo);

  if (practicas.length === 0) {
    // Un docente que llegue aquí no tiene nada que hacer en el portal. A un
    // estudiante pudieron cambiarle el correo o quitarlo de la matriz.
    const supabase = await createClient();
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", correo)
      .maybeSingle();

    if (perfil?.role !== "estudiante") redirect("/dashboard");

    return (
      <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h1 className="text-lg font-semibold text-slate-800">
          No encontramos tu práctica
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          No hay ninguna práctica registrada con {correo}. Pregúntale a tu docente
          con qué correo te registró.
        </p>
      </div>
    );
  }

  const { p: elegida } = await searchParams;
  const practica = practicas.find((x) => x.id === elegida) ?? practicas[0];

  const admin = createAdminClient();
  const [{ data: soportes }, { data: docente }] = await Promise.all([
    admin
      .from("soportes")
      .select("id, tipo_documento, nombre_archivo, subido_en, subido_por")
      .eq("practicante_id", practica.id)
      .order("subido_en", { ascending: false }),
    admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", practica.docente_id)
      .maybeSingle(),
  ]);

  // La fecha se formatea aquí, en una sola zona horaria: si lo hiciera el
  // componente de cliente, servidor (UTC) y navegador podrían no coincidir.
  const fechaCorta = (iso: string) =>
    new Date(iso).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Bogota",
    });
  const todos = soportes ?? [];

  // Lo que cuenta para la guía: solo los archivos marcados con un requisito.
  const documentos: DocumentoEntregado[] = todos
    .filter((s) => s.tipo_documento)
    .map((s) => ({
      id: s.id,
      tipo_documento: s.tipo_documento as string,
      nombre_archivo: s.nombre_archivo,
      fecha: fechaCorta(s.subido_en),
    }));

  // Todo lo que hay en su carpeta, incluidos los soportes que el docente subió
  // antes del portal o sin indicar a qué requisito corresponden. La descripción
  // no se muestra: la escribe el docente y puede llevar notas internas.
  const archivos: ArchivoPractica[] = todos.map((s) => {
    const requisito = REQUISITOS_GUIA.find((r) => r.id === s.tipo_documento);
    return {
      id: s.id,
      nombre: s.nombre_archivo,
      corresponde: requisito ? etiquetaSoporte(requisito) : "Otro documento",
      subidoPor:
        s.subido_por === "estudiante" ? "Subido por ti" : "Subido por tu docente",
      fecha: fechaCorta(s.subido_en),
    };
  });
  const completitud = calcularCompletitud(practica, documentos);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Hola, {practica.nombre_completo?.split(" ")[0] || "estudiante"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {[practica.practica, practica.empresa].filter(Boolean).join(" · ") ||
          "Tu espacio de prácticas"}
      </p>
      {docente && (
        <p className="mt-1 text-sm text-slate-500">
          Tu docente: {docente.full_name || docente.email}
          {docente.full_name ? ` (${docente.email})` : ""}
        </p>
      )}

      {practicas.length > 1 && (
        <nav aria-label="Tus prácticas" className="mt-4 flex flex-wrap gap-2">
          {practicas.map((x) => (
            <Link
              key={x.id}
              href={`/mi-practica?p=${x.id}`}
              aria-current={x.id === practica.id ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                x.id === practica.id
                  ? "border-primary bg-primary text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
              }`}
            >
              {x.practica ?? "Práctica"}
            </Link>
          ))}
        </nav>
      )}

      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Indicador etiqueta="Paso actual" valor={practica.avance ?? "Sin indicar"} />
        <Indicador
          etiqueta="Datos"
          valor={`${completitud.datos.hechos} de ${completitud.datos.total}`}
        />
        <Indicador
          etiqueta="Entregables"
          valor={`${completitud.entregables.hechos} de ${completitud.entregables.total}`}
        />
      </dl>

      {/* La clave reinicia los mensajes y formularios al cambiar de práctica. */}
      <GuiaPasos
        key={`guia-${practica.id}`}
        practicanteId={practica.id}
        avance={practica.avance}
        documentos={documentos}
        formularios={practica.formularios_diligenciados}
        datosCompletos={completitud.datos.hechos === completitud.datos.total}
      />

      <ListaArchivos archivos={archivos} />

      <FormularioDatos key={`datos-${practica.id}`} practica={practica} />

      <p className="mt-6 text-xs text-slate-500">
        Tu docente ve en qué paso vas y qué te falta por entregar.
      </p>
    </div>
  );
}

function Indicador({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <dt className="text-xs text-slate-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-bold text-slate-900 sm:text-lg">{valor}</dd>
    </div>
  );
}

type ArchivoPractica = {
  id: string;
  nombre: string;
  corresponde: string;
  subidoPor: string;
  fecha: string;
};

function ListaArchivos({ archivos }: { archivos: ArchivoPractica[] }) {
  return (
    <section aria-labelledby="titulo-archivos" className="mt-8">
      <h2 id="titulo-archivos" className="text-lg font-bold text-slate-900">
        Tus documentos
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Todo lo que está guardado en tu carpeta de prácticas, lo hayas subido tú o
        tu docente.
      </p>

      {archivos.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
          Aún no hay documentos en tu carpeta.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {archivos.map((a) => (
            <li key={a.id} className="p-3 sm:px-4">
              <p className="break-words text-sm font-medium text-slate-900">
                {a.nombre}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {a.corresponde} · {a.subidoPor} · {a.fecha}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
