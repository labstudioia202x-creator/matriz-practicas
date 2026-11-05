import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerAccessToken } from "@/lib/microsoft/conexion";
import { asegurarSubcarpeta, subirArchivo } from "@/lib/microsoft/graph";
import { obtenerUrlFlujo, subirPorFlujo } from "@/lib/soportes/flujo";

export type RegistroSoporte = {
  nombre_archivo: string;
  tamano_bytes: number;
  sharepoint_item_id: string | null;
  web_url: string | null;
  destino: "microsoft" | "power_automate";
};

/**
 * Sube un archivo al destino que configuró el docente, dentro de la subcarpeta
 * del estudiante. Lo usan tanto el docente como el portal del estudiante: los
 * documentos quedan siempre en la carpeta del docente.
 *
 * Devuelve null si el docente aún no ha configurado ningún destino.
 */
export async function subirADestinoDelDocente(
  docenteId: string,
  carpeta: string,
  archivo: File,
  nombreArchivo: string
): Promise<RegistroSoporte | null> {
  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("profiles")
    .select("sharepoint_drive_id, sharepoint_item_id, flujo_configurado")
    .eq("id", docenteId)
    .maybeSingle();

  // El flujo de Power Automate tiene prioridad: es el que funciona sin registro
  // de aplicación en Entra ID.
  const urlFlujo = perfil?.flujo_configurado
    ? await obtenerUrlFlujo(docenteId)
    : null;

  if (urlFlujo) {
    const contenido = await archivo.arrayBuffer();
    const subido = await subirPorFlujo(
      urlFlujo,
      carpeta,
      nombreArchivo,
      contenido
    );
    return {
      nombre_archivo: nombreArchivo,
      tamano_bytes: archivo.size,
      sharepoint_item_id: subido.id,
      web_url: subido.webUrl,
      destino: "power_automate",
    };
  }

  if (perfil?.sharepoint_drive_id && perfil?.sharepoint_item_id) {
    const contenido = await archivo.arrayBuffer();
    const accessToken = await obtenerAccessToken(docenteId);
    const carpetaEstudianteId = await asegurarSubcarpeta(
      accessToken,
      perfil.sharepoint_drive_id,
      perfil.sharepoint_item_id,
      carpeta
    );
    const subido = await subirArchivo(
      accessToken,
      perfil.sharepoint_drive_id,
      carpetaEstudianteId,
      nombreArchivo,
      contenido,
      archivo.type
    );
    return {
      nombre_archivo: subido.name,
      tamano_bytes: subido.size ?? archivo.size,
      sharepoint_item_id: subido.id,
      web_url: subido.webUrl,
      destino: "microsoft",
    };
  }

  return null;
}
