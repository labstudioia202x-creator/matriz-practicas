"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obtenerAccessToken, eliminarConexion } from "@/lib/microsoft/conexion";
import { resolverCarpeta } from "@/lib/microsoft/graph";
import { guardarUrlFlujo, eliminarUrlFlujo } from "@/lib/soportes/flujo";
import {
  guardarUrlFlujoComunicaciones,
  eliminarUrlFlujoComunicaciones,
} from "@/lib/comunicaciones/flujo";
import { validarUrlDisparador } from "@/lib/power-automate";

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
 * Guarda la URL del disparador del flujo de soportes.
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

  const errorUrl = validarUrlDisparador(url);
  if (errorUrl) return { error: errorUrl };

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

/** Guarda la URL del flujo que envía las comunicaciones por Teams y correo. */
export async function guardarFlujoComunicaciones(
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

  const url = String(formData.get("url_flujo") ?? "").replace(/\s+/g, "");

  const errorUrl = validarUrlDisparador(url);
  if (errorUrl) return { error: errorUrl };

  try {
    await guardarUrlFlujoComunicaciones(user.id, url);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se pudo guardar el flujo.",
    };
  }

  revalidatePath("/configuracion");
  revalidatePath("/comunicaciones");
  return { ok: "Flujo guardado. Ya puedes enviar comunicaciones." };
}

export async function quitarFlujoComunicaciones(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await eliminarUrlFlujoComunicaciones(user.id);
  revalidatePath("/configuracion");
  revalidatePath("/comunicaciones");
}
