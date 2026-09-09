import { createAdminClient } from "@/lib/supabase/admin";
import { refrescarTokens, GraphError, TokensMicrosoft } from "./graph";
import { microsoftConfigurado } from "./config";

/**
 * Guarda (o reemplaza) la conexión de Microsoft de un docente.
 * Microsoft rota el refresh token en cada uso, por eso siempre se regraba.
 */
export async function guardarConexion(
  docenteId: string,
  tokens: TokensMicrosoft,
  cuentaEmail: string | null
) {
  if (!tokens.refresh_token) {
    throw new GraphError(
      "Microsoft no devolvió refresh token. Verifica que el permiso offline_access esté habilitado."
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.from("microsoft_conexiones").upsert(
    {
      docente_id: docenteId,
      cuenta_email: cuentaEmail,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope ?? null,
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "docente_id" }
  );

  if (error) throw new GraphError(error.message);

  await admin
    .from("profiles")
    .update({ microsoft_email: cuentaEmail })
    .eq("id", docenteId);
}

export async function eliminarConexion(docenteId: string) {
  const admin = createAdminClient();

  await admin.from("microsoft_conexiones").delete().eq("docente_id", docenteId);
  await admin
    .from("profiles")
    .update({
      microsoft_email: null,
      sharepoint_drive_id: null,
      sharepoint_item_id: null,
    })
    .eq("id", docenteId);
}

/**
 * Access token vigente del docente. Los access token de Microsoft duran ~1h,
 * así que se pide uno nuevo con el refresh token en cada operación.
 */
export async function obtenerAccessToken(docenteId: string): Promise<string> {
  if (!microsoftConfigurado()) {
    throw new GraphError(
      "La integración con Microsoft no está configurada en el servidor (faltan MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)."
    );
  }

  const admin = createAdminClient();

  const { data: conexion } = await admin
    .from("microsoft_conexiones")
    .select("refresh_token, cuenta_email")
    .eq("docente_id", docenteId)
    .maybeSingle();

  if (!conexion?.refresh_token) {
    throw new GraphError(
      "No has conectado tu cuenta de Microsoft. Ve a Configuración y conéctala."
    );
  }

  let tokens: TokensMicrosoft;
  try {
    tokens = await refrescarTokens(conexion.refresh_token);
  } catch {
    // El refresh token caducó o fue revocado: se borra para forzar reconexión.
    await admin
      .from("microsoft_conexiones")
      .delete()
      .eq("docente_id", docenteId);
    throw new GraphError(
      "La conexión con Microsoft caducó. Vuelve a conectarla en Configuración."
    );
  }

  if (tokens.refresh_token) {
    await admin
      .from("microsoft_conexiones")
      .update({
        refresh_token: tokens.refresh_token,
        actualizado_en: new Date().toISOString(),
      })
      .eq("docente_id", docenteId);
  }

  return tokens.access_token;
}
