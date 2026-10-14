import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Comunicacion, ComunicacionEnvio, Practicante } from "@/lib/types";
import { ETIQUETA_CANAL } from "@/lib/comunicaciones/plantilla";
import EnvioComunicaciones from "@/components/EnvioComunicaciones";

export const dynamic = "force-dynamic";
// Cada lote espera la respuesta del flujo por estudiante y canal.
export const maxDuration = 60;

export default async function ComunicacionesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: perfil }, { data: practicantes }, { data: comunicaciones }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email, flujo_comunicaciones_configurado")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("practicantes")
        .select("*")
        .eq("docente_id", user.id)
        .order("nombre_completo", { ascending: true }),
      supabase
        .from("comunicaciones")
        .select("*")
        .eq("docente_id", user.id)
        .order("creado_en", { ascending: false })
        .limit(15),
    ]);

  const historial = (comunicaciones ?? []) as Comunicacion[];

  const { data: envios } = historial.length
    ? await supabase
        .from("comunicacion_envios")
        .select("comunicacion_id, nombre, canal, estado, error")
        .in(
          "comunicacion_id",
          historial.map((c) => c.id)
        )
    : { data: [] };

  const enviosPorComunicacion = new Map<string, ComunicacionEnvio[]>();
  for (const e of (envios ?? []) as ComunicacionEnvio[]) {
    const lista = enviosPorComunicacion.get(e.comunicacion_id) ?? [];
    lista.push(e);
    enviosPorComunicacion.set(e.comunicacion_id, lista);
  }

  const flujoConfigurado = Boolean(perfil?.flujo_comunicaciones_configurado);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Comunicaciones</h1>
      <p className="mt-1 text-sm text-slate-500">
        Escribe un solo mensaje y envíalo personalizado al chat de Teams y al
        correo de cada estudiante.
      </p>

      {!flujoConfigurado && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Para enviar comunicaciones primero configura tu flujo de Power
          Automate en{" "}
          <Link href="/configuracion" className="font-semibold underline">
            Configuración
          </Link>
          .
        </div>
      )}

      <div className="mt-6">
        <EnvioComunicaciones
          practicantes={(practicantes ?? []) as Practicante[]}
          docente={perfil?.full_name || perfil?.email || ""}
          habilitado={flujoConfigurado}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-slate-900">Historial</h2>
        {historial.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Aún no has enviado comunicaciones.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {historial.map((c) => {
              const lista = enviosPorComunicacion.get(c.id) ?? [];
              const cuenta = (estado: ComunicacionEnvio["estado"]) =>
                lista.filter((e) => e.estado === estado).length;
              const problemas = lista.filter((e) => e.estado !== "enviado");
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">{c.asunto}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(c.creado_en).toLocaleString("es-CO", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "America/Bogota",
                      })}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {c.total_destinatarios} estudiantes ·{" "}
                    {c.canales.map((canal) => ETIQUETA_CANAL[canal]).join(" + ")}{" "}
                    · <span className="text-green-700">{cuenta("enviado")} enviados</span>
                    {cuenta("fallido") > 0 && (
                      <span className="text-red-700"> · {cuenta("fallido")} fallidos</span>
                    )}
                    {cuenta("omitido") > 0 && (
                      <span className="text-amber-700"> · {cuenta("omitido")} omitidos</span>
                    )}
                  </p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600">
                      Ver mensaje{problemas.length > 0 && " y envíos con problemas"}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">
                      {c.mensaje}
                    </p>
                    {problemas.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {problemas.map((e, i) => (
                          <li key={i} className="text-slate-600">
                            <b>{e.nombre}</b> ({ETIQUETA_CANAL[e.canal]}):{" "}
                            {e.estado} — {e.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
