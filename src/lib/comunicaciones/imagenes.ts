import {
  MAXIMO_IMAGENES_COMUNICACION,
  TAMANO_MAXIMO_IMAGENES_MB,
} from "@/lib/constants";

/** Formatos que Outlook muestra sin problema como adjunto. */
export const TIPOS_IMAGEN: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
};

export const ACCEPT_IMAGENES = Object.values(TIPOS_IMAGEN).flat().join(",");

type ArchivoImagen = { name: string; size: number; type: string };

/**
 * Valida las imágenes de una comunicación. La usan el navegador, para avisar
 * antes de enviar, y el servidor, que es quien decide. Devuelve el error o null.
 */
export function validarImagenes(archivos: ArchivoImagen[]): string | null {
  if (archivos.length > MAXIMO_IMAGENES_COMUNICACION) {
    return `Puedes adjuntar máximo ${MAXIMO_IMAGENES_COMUNICACION} imágenes.`;
  }

  for (const archivo of archivos) {
    const extensiones = TIPOS_IMAGEN[archivo.type];
    const nombre = archivo.name.toLowerCase();
    if (!extensiones || !extensiones.some((ext) => nombre.endsWith(ext))) {
      return `"${archivo.name}" no es una imagen JPG, PNG, GIF o WEBP.`;
    }
    if (archivo.size === 0) return `"${archivo.name}" está vacío.`;
  }

  const total = archivos.reduce((suma, a) => suma + a.size, 0);
  if (total > TAMANO_MAXIMO_IMAGENES_MB * 1024 * 1024) {
    return `Las imágenes suman más de ${TAMANO_MAXIMO_IMAGENES_MB} MB. Quita alguna o guárdalas en menor calidad.`;
  }

  return null;
}
