import { createAdminClient } from "@/lib/supabase/admin";

export type ArchivoSubido = { id: string | null; webUrl: string | null };

export class FlujoError extends Error {}

/**
 * Guarda la URL del disparador HTTP del flujo de Power Automate del docente.
 * La URL incluye la firma `sig=`, así que es una credencial: vive en una tabla
 * que solo el servidor puede leer.
 */
export async function guardarUrlFlujo(docenteId: string, url: string) {
  const admin = createAdminClient();

  const { error } = await admin.from("flujos_soportes").upsert(
    { docente_id: docenteId, url, actualizado_en: new Date().toISOString() },
    { onConflict: "docente_id" }
  );

  if (error) throw new FlujoError(error.message);

  await admin
    .from("profiles")
    .update({ flujo_configurado: true })
    .eq("id", docenteId);
}

export async function eliminarUrlFlujo(docenteId: string) {
  const admin = createAdminClient();

  await admin.from("flujos_soportes").delete().eq("docente_id", docenteId);
  await admin
    .from("profiles")
    .update({ flujo_configurado: false })
    .eq("id", docenteId);
}

export async function obtenerUrlFlujo(
  docenteId: string
): Promise<string | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("flujos_soportes")
    .select("url")
    .eq("docente_id", docenteId)
    .maybeSingle();

  return data?.url ?? null;
}

/**
 * Envía el archivo al flujo. El flujo se encarga de crear la subcarpeta del
 * estudiante dentro de la carpeta raíz que el docente configuró en él.
 */
export async function subirPorFlujo(
  urlFlujo: string,
  carpeta: string,
  nombreArchivo: string,
  contenido: ArrayBuffer
): Promise<ArchivoSubido> {
  let respuesta: Response;

  try {
    respuesta = await fetch(urlFlujo, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carpeta,
        nombreArchivo,
        contenidoBase64: Buffer.from(contenido).toString("base64"),
      }),
      cache: "no-store",
    });
  } catch {
    throw new FlujoError(
      "No se pudo contactar el flujo de Power Automate. Revisa tu conexión."
    );
  }

  const texto = await respuesta.text();

  if (!respuesta.ok) {
    // 502 = el flujo se ejecutó pero alguna acción falló antes de responder.
    if (respuesta.status === 502) {
      throw new FlujoError(
        "El flujo falló al guardar el archivo en OneDrive. Revisa su historial de ejecuciones en Power Automate."
      );
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new FlujoError(
        "El flujo rechazó la petición. Es posible que la firma de la URL haya cambiado; vuelve a copiarla en Configuración."
      );
    }
    throw new FlujoError(
      `El flujo respondió con error ${respuesta.status}. ${texto.slice(0, 200)}`
    );
  }

  // La acción "Respuesta" es opcional en el flujo: si no está, no hay cuerpo.
  try {
    const datos = JSON.parse(texto) as { id?: string; webUrl?: string };
    return { id: datos.id || null, webUrl: datos.webUrl || null };
  } catch {
    return { id: null, webUrl: null };
  }
}
