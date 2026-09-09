"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obtenerAccessToken, eliminarConexion } from "@/lib/microsoft/conexion";
import { resolverCarpeta } from "@/lib/microsoft/graph";
import { guardarUrlFlujo, eliminarUrlFlujo } from "@/lib/soportes/flujo";

export type ConfigState =
  | { error?: string; ok?: string; carpeta?: string }
  | undefined;

/**
 * Guarda la carpeta de OneDrive/SharePoint del docente. Además de almacenar la
 * URL, la resuelve contra Graph para verificar que existe y que el docente
 * tiene acceso, y cachea el driveId/itemId que se usarán al subir soportes.
 */
export async function guardarCarpeta(
  state: ConfigState,
  formData: FormData
): Promise<ConfigState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const url = String(formData.get("sharepoint_carpeta_url") ?? "").trim();

  if (!url) {
    const { error } = await supabase
      .from("profiles")
      .update({
        sharepoint_carpeta_url: null,
        sharepoint_drive_id: null,
        sharepoint_item_id: null,
        sharepoint_carpeta_nombre: null,
      })
      .eq("id", user.id);

    if (error) return { error: error.message };

    revalidatePath("/configuracion");
    return { ok: "Se quitó la carpeta de destino." };
  }

  if (!/^https:\/\/[\w-]+(\.[\w-]+)*\.sharepoint\.com\//i.test(url)) {
    return {
      error:
        "La dirección debe ser un enlace de OneDrive o SharePoint de la universidad (…sharepoint.com/…).",
    };
  }

  let carpeta;
  try {
    const accessToken = await obtenerAccessToken(user.id);
    carpeta = await resolverCarpeta(accessToken, url);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo verificar la carpeta.",
    };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      sharepoint_carpeta_url: url,
      sharepoint_drive_id: carpeta.driveId,
      sharepoint_item_id: carpeta.itemId,
      sharepoint_carpeta_nombre: carpeta.nombre,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/configuracion");
  return { ok: "Carpeta verificada correctamente.", carpeta: carpeta.nombre };
}

export async function desconectarMicrosoft(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await eliminarConexion(user.id);
  revalidatePath("/configuracion");
}

// ---------------------------------------------------------------------------
// POWER AUTOMATE
// ---------------------------------------------------------------------------

/**
 * Guarda la URL del disparador del flujo. Se valida el formato y se comprueba
 * que traiga la firma `sig=`: sin ella el flujo exige un token de Entra ID que
 * la aplicación no puede obtener.
 */
export async function guardarFlujo(
  state: ConfigState,
  formData: FormData
): Promise<ConfigState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  // El textarea puede traer saltos de línea del copiar/pegar.
  const url = String(formData.get("url_flujo") ?? "").replace(/\s+/g, "");

  if (!url) {
    return { error: "Pega la URL HTTP POST del disparador de tu flujo." };
  }

  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    return { error: "Eso no es una dirección web válida." };
  }

  if (direccion.protocol !== "https:") {
    return { error: "La URL del disparador debe empezar por https://" };
  }

  if (!/\/triggers\/[^/]+\/paths\/invoke/i.test(direccion.pathname)) {
    return {
      error:
        "Esa no parece la URL del disparador. Debe contener /triggers/manual/paths/invoke.",
    };
  }

  if (!direccion.searchParams.get("sig")) {
    return {
      error:
        'A la URL le falta la firma (sig=). En el disparador, cambia "¿Quién puede desencadenar el flujo?" a "Cualquiera", guarda y copia la URL de nuevo.',
    };
  }

  try {
    await guardarUrlFlujo(user.id, url);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo guardar el flujo.",
    };
  }

  revalidatePath("/configuracion");
  return { ok: "Flujo guardado. Ya puedes subir soportes." };
}

export async function quitarFlujo(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await eliminarUrlFlujo(user.id);
  revalidatePath("/configuracion");
}
