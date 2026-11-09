import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Comunicacion, ComunicacionEnvio, Practicante } from "@/lib/types";
import { ETIQUETA_CANAL } from "@/lib/comunicaciones/plantilla";
import EnvioComunicaciones from "@/components/EnvioComunicaciones";
import AccionesHistorial from "@/components/AccionesHistorial";

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

  // La API de Supabase devuelve como máximo 1.000 filas por consulta y corta el
  // resto sin avisar. Con 15 comunicaciones de ~90 envíos se pasaba del tope y
  // el historial mostraba como "sin enviar" lo que sí había salido; por eso se
  // leen por páginas hasta tenerlos todos.
  const envios: ComunicacionEnvio[] = [];
  let historialIncompleto = false;
  if (historial.length) {
    const POR_PAGINA = 1000;
    let total: number | null = null;
    // Avanza según lo que llegó (no según POR_PAGINA): si el tope del servidor
    // fuera menor, no se salta filas.
    while (total === null || envios.length < total) {
      const { data, error, count } = await supabase
        .from("comunicacion_envios")
        .select(
          "id, comunicacion_id, practicante_id, nombre, canal, estado, error",
          { count: "exact" }
        )
        .in(
          "comunicacion_id",
          historial.map((c) => c.id)
        )
        .order("id")
        .range(envios.length, envios.length + POR_PAGINA - 1);

      if (error || count === null) {
        console.error("No se pudo leer el historial de envíos:", error?.message);
        historialIncompleto = true;
        break;
      }
      total = count;
      if (!data?.length) break;
      envios.push(...(data as ComunicacionEnvio[]));
    }
  }

  // Las imágenes solo las lee el servidor; los ids ya vienen filtrados por RLS
  // a las comunicaciones del docente.
  const { data: adjuntos } = historial.length
    ? await createAdminClient()
        .from("comunicacion_adjuntos")
        .select("comunicacion_id")
        .in(
          "comunicacion_id",
          historial.map((c) => c.id)
        )
    : { data: [] };

  const imagenesPorComunicacion = new Map<string, number>();
  for (const a of adjuntos ?? []) {
    imagenesPorComunicacion.set(
      a.comunicacion_id,
      (imagenesPorComunicacion.get(a.comunicacion_id) ?? 0) + 1
    );
  }

  const enviosPorComunicacion = new Map<string, ComunicacionEnvio[]>();
  for (const e of envios) {
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
        {historialIncompleto && (
          <p role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
            No se pudo cargar el estado completo de los envíos, así que los
            conteos pueden estar incompletos. Recarga la página antes de
            reenviar algo.
          </p>
        )}
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
              const conRegistro = new Set(lista.map((e) => e.practicante_id));
              const pendientes = (c.destinatarios ?? []).filter(
                (id) => !conRegistro.has(id)
              );
              const fallidos = [
                ...new Set(
                  lista
                    .filter((e) => e.estado === "fallido" && e.practicante_id)
                    .map((e) => e.practicante_id as string)
                ),
              ];
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
                    {imagenesPorComunicacion.has(c.id) &&
                      `· ${imagenesPorComunicacion.get(c.id)} ${
                        imagenesPorComunicacion.get(c.id) === 1 ? "imagen" : "imágenes"
                      } `}
                    · <span className="text-green-700">{cuenta("enviado")} enviados</span>
                    {cuenta("fallido") > 0 && (
                      <span className="text-red-700"> · {cuenta("fallido")} fallidos</span>
                    )}
                    {cuenta("omitido") > 0 && (
                      <span className="text-amber-700"> · {cuenta("omitido")} omitidos</span>
                    )}
                    {pendientes.length > 0 && (
                      <span className="font-semibold text-red-700">
                        {" "}· {pendientes.length} estudiantes sin enviar
                      </span>
                    )}
                  </p>
                  <AccionesHistorial
                    comunicacionId={c.id}
                    pendientes={pendientes}
                    fallidos={fallidos}
                  />
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
