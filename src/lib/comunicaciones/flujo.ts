import { createAdminClient } from "@/lib/supabase/admin";
import { Canal } from "@/lib/comunicaciones/plantilla";

export class FlujoComunicacionesError extends Error {}

/**
 * La URL del flujo de comunicaciones también lleva firma `sig=` y permite
 * enviar mensajes en nombre del docente: vive en una tabla que solo el
 * servidor puede leer, igual que la del flujo de soportes.
 */
export async function guardarUrlFlujoComunicaciones(
  docenteId: string,
  url: string
) {
  const admin = createAdminClient();

  const { error } = await admin.from("flujos_comunicaciones").upsert(
    { docente_id: docenteId, url, actualizado_en: new Date().toISOString() },
    { onConflict: "docente_id" }
  );

  if (error) throw new FlujoComunicacionesError(error.message);

  await admin
    .from("profiles")
    .update({ flujo_comunicaciones_configurado: true })
    .eq("id", docenteId);
}

export async function eliminarUrlFlujoComunicaciones(docenteId: string) {
  const admin = createAdminClient();

  await admin.from("flujos_comunicaciones").delete().eq("docente_id", docenteId);
  await admin
    .from("profiles")
    .update({ flujo_comunicaciones_configurado: false })
    .eq("id", docenteId);
}

export async function obtenerUrlFlujoComunicaciones(
  docenteId: string
): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("flujos_comunicaciones")
    .select("url")
    .eq("docente_id", docenteId)
    .maybeSingle();

  return data?.url ?? null;
}

/**
 * Envía UN mensaje (un estudiante, un canal). El flujo decide con `canal` si
 * publica en Teams o manda el correo, y responde 200 al terminar.
 */
export async function enviarPorFlujo(
  urlFlujo: string,
  mensaje: { canal: Canal; correo: string; asunto: string; mensajeHtml: string }
): Promise<void> {
  let respuesta: Response;

  try {
    respuesta = await fetch(urlFlujo, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mensaje),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new FlujoComunicacionesError(
      "No se obtuvo respuesta del flujo de Power Automate."
    );
  }

  if (respuesta.ok) return;

  if (respuesta.status === 502) {
    throw new FlujoComunicacionesError(
      mensaje.canal === "teams"
        ? "El flujo no pudo publicar en Teams (¿el correo pertenece a una cuenta de Teams de la universidad?)."
        : "El flujo no pudo enviar el correo. Revisa su historial de ejecuciones."
    );
  }
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new FlujoComunicacionesError(
      "El flujo rechazó la petición: la firma de la URL pudo cambiar."
    );
  }
  if (respuesta.status === 429) {
    throw new FlujoComunicacionesError(
      "Power Automate limitó las peticiones (429). Reintenta en unos minutos."
    );
  }

  const texto = await respuesta.text();
  throw new FlujoComunicacionesError(
    `El flujo respondió con error ${respuesta.status}. ${texto.slice(0, 200)}`
  );
}
