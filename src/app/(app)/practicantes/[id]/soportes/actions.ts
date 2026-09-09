"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TAMANO_MAXIMO_SOPORTE_MB } from "@/lib/constants";
import { obtenerAccessToken } from "@/lib/microsoft/conexion";
import { obtenerUrlFlujo, subirPorFlujo } from "@/lib/soportes/flujo";
import {
  asegurarSubcarpeta,
  eliminarArchivo,
  sanitizarNombre,
  subirArchivo,
} from "@/lib/microsoft/graph";

export type SoporteState = { error?: string; ok?: string } | undefined;

// Extensiones que nunca tiene sentido guardar como soporte.
const EXTENSIONES_BLOQUEADAS = [
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".vbs", ".js", ".jar",
];

export async function subirSoporte(
  state: SoporteState,
  formData: FormData
): Promise<SoporteState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const practicanteId = String(formData.get("practicante_id") ?? "");
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const archivo = formData.get("archivo");

  if (!practicanteId) {
    return { error: "No se pudo identificar el practicante." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo para subir." };
  }
  if (archivo.size > TAMANO_MAXIMO_SOPORTE_MB * 1024 * 1024) {
    return {
      error: `El archivo supera el límite de ${TAMANO_MAXIMO_SOPORTE_MB} MB.`,
    };
  }

  const nombreMinuscula = archivo.name.toLowerCase();
  if (EXTENSIONES_BLOQUEADAS.some((ext) => nombreMinuscula.endsWith(ext))) {
    return { error: "Ese tipo de archivo no se permite como soporte." };
  }

  // El practicante debe pertenecer al docente (además de la RLS).
  const { data: practicante } = await supabase
    .from("practicantes")
    .select("id, docente_id, nombre_completo")
    .eq("id", practicanteId)
    .maybeSingle();

  if (!practicante || practicante.docente_id !== user.id) {
    return { error: "No tienes permiso sobre este practicante." };
  }
  if (!practicante.nombre_completo) {
    return {
      error:
        "El practicante no tiene nombre completo, y ese es el nombre de su carpeta. Complétalo antes de subir soportes.",
    };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("sharepoint_drive_id, sharepoint_item_id, flujo_configurado")
    .eq("id", user.id)
    .maybeSingle();

  const urlFlujo = perfil?.flujo_configurado
    ? await obtenerUrlFlujo(user.id)
    : null;
  const viaMicrosoft = Boolean(
    perfil?.sharepoint_drive_id && perfil?.sharepoint_item_id
  );

  if (!urlFlujo && !viaMicrosoft) {
    return {
      error:
        "Todavía no has configurado el destino de los soportes. Configúralo en Configuración.",
    };
  }

  const nombreCarpeta = sanitizarNombre(practicante.nombre_completo);

  try {
    const contenido = await archivo.arrayBuffer();

    // El flujo de Power Automate tiene prioridad: es el que funciona sin
    // registro de aplicación en Entra ID.
    const registro = urlFlujo
      ? await (async () => {
          const subido = await subirPorFlujo(
            urlFlujo,
            nombreCarpeta,
            archivo.name,
            contenido
          );
          return {
            nombre_archivo: archivo.name,
            tamano_bytes: archivo.size,
            sharepoint_item_id: subido.id,
            web_url: subido.webUrl,
            destino: "power_automate" as const,
          };
        })()
      : await (async () => {
          const accessToken = await obtenerAccessToken(user.id);
          const carpetaEstudianteId = await asegurarSubcarpeta(
            accessToken,
            perfil!.sharepoint_drive_id!,
            perfil!.sharepoint_item_id!,
            nombreCarpeta
          );
          const subido = await subirArchivo(
            accessToken,
            perfil!.sharepoint_drive_id!,
            carpetaEstudianteId,
            archivo.name,
            contenido,
            archivo.type
          );
          return {
            nombre_archivo: subido.name,
            tamano_bytes: subido.size ?? archivo.size,
            sharepoint_item_id: subido.id,
            web_url: subido.webUrl,
            destino: "microsoft" as const,
          };
        })();

    const { error } = await supabase.from("soportes").insert({
      practicante_id: practicanteId,
      docente_id: user.id,
      descripcion: descripcion || null,
      tipo_mime: archivo.type || null,
      carpeta: nombreCarpeta,
      ...registro,
    });

    if (error) {
      return {
        error: `El archivo se subió a OneDrive pero no se pudo registrar: ${error.message}`,
      };
    }
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "No se pudo subir el archivo a OneDrive.",
    };
  }

  revalidatePath(`/practicantes/${practicanteId}/soportes`);
  return { ok: `Se subió "${archivo.name}" a la carpeta ${nombreCarpeta}.` };
}

export async function eliminarSoporte(
  state: SoporteState,
  formData: FormData
): Promise<SoporteState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { error: "No se pudo identificar el soporte." };
  }

  const { data: soporte } = await supabase
    .from("soportes")
    .select("id, practicante_id, docente_id, sharepoint_item_id, destino")
    .eq("id", id)
    .maybeSingle();

  if (!soporte || soporte.docente_id !== user.id) {
    return { error: "No tienes permiso sobre este soporte." };
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("sharepoint_drive_id")
    .eq("id", user.id)
    .maybeSingle();

  const soloRegistro = soporte.destino === "power_automate";

  // Primero el archivo remoto: si falla, no se pierde el registro que lo
  // referencia. El flujo de Power Automate solo sabe crear archivos, así que
  // en ese caso se borra únicamente el registro y se avisa al docente.
  if (!soloRegistro && soporte.sharepoint_item_id && perfil?.sharepoint_drive_id) {
    try {
      const accessToken = await obtenerAccessToken(user.id);
      await eliminarArchivo(
        accessToken,
        perfil.sharepoint_drive_id,
        soporte.sharepoint_item_id
      );
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo eliminar el archivo en SharePoint.",
      };
    }
  }

  const { error } = await supabase.from("soportes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/practicantes/${soporte.practicante_id}/soportes`);
  return {
    ok: soloRegistro
      ? "Soporte quitado de la lista. El archivo sigue en tu OneDrive: bórralo desde ahí si también quieres eliminarlo."
      : "Soporte eliminado.",
  };
}
