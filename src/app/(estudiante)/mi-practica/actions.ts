"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AVANCES,
  MODALIDADES,
  PROGRAMAS_ACADEMICOS,
  SEMESTRES,
  TAMANO_MAXIMO_PORTAL_MB,
} from "@/lib/constants";
import { sanitizarNombre } from "@/lib/microsoft/graph";
import {
  CAMPOS_ESTUDIANTE,
  etiquetaSoporte,
  PASO_CON_REQUISITOS_OBLIGATORIOS,
  PASOS_GUIA,
  REQUISITOS_GUIA,
  requisitosPendientes,
} from "@/lib/portal/guia";
import { correoDeLaSesion, practicaDelCorreo } from "@/lib/portal/sesion";
import { subirADestinoDelDocente } from "@/lib/soportes/subir";

export type PortalState = { error?: string; ok?: string } | undefined;

const SESION_VENCIDA = "Tu sesión expiró. Vuelve a entrar con un código.";
const SIN_PERMISO = "No encontramos esta práctica en tu cuenta.";

// A diferencia del docente, aquí se permite solo lo que tiene sentido como
// documento: estos archivos terminan en la carpeta de OneDrive del docente.
const EXTENSIONES_PERMITIDAS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".jpg", ".jpeg", ".png",
];

export async function marcarAvance(
  state: PortalState,
  formData: FormData
): Promise<PortalState> {
  const correo = await correoDeLaSesion();
  if (!correo) return { error: SESION_VENCIDA };

  const id = String(formData.get("practicante_id") ?? "");
  const avance = String(formData.get("avance") ?? "");

  if (!AVANCES.includes(avance as never)) {
    return { error: "Selecciona un paso válido." };
  }

  const practica = await practicaDelCorreo(correo, id);
  if (!practica) return { error: SIN_PERMISO };

  const admin = createAdminClient();

  // Se valida aquí, no solo en la interfaz: el botón deshabilitado se puede saltar.
  if (avance === PASO_CON_REQUISITOS_OBLIGATORIOS) {
    const { data: soportes } = await admin
      .from("soportes")
      .select("tipo_documento")
      .eq("practicante_id", practica.id);

    const pendientes = requisitosPendientes(
      PASO_CON_REQUISITOS_OBLIGATORIOS,
      practica.formularios_diligenciados,
      soportes ?? []
    );

    if (pendientes.length > 0) {
      return {
        error: `Para marcar la práctica como finalizada te falta: ${pendientes
          .map((r) => r.nombre)
          .join(", ")}.`,
      };
    }
  }

  const { error } = await admin
    .from("practicantes")
    .update({ avance, avance_actualizado_en: new Date().toISOString() })
    .eq("id", practica.id);

  if (error) {
    return { error: "No pudimos guardar tu avance. Intenta de nuevo." };
  }

  revalidatePath("/mi-practica");
  return { ok: `Listo: tu práctica quedó en "${avance}".` };
}

export async function marcarFormulario(
  state: PortalState,
  formData: FormData
): Promise<PortalState> {
  const correo = await correoDeLaSesion();
  if (!correo) return { error: SESION_VENCIDA };

  const practica = await practicaDelCorreo(
    correo,
    String(formData.get("practicante_id") ?? "")
  );
  if (!practica) return { error: SIN_PERMISO };

  const formulario = String(formData.get("formulario") ?? "");
  if (
    !REQUISITOS_GUIA.some((r) => r.id === formulario && r.tipo === "formulario")
  ) {
    return { error: "Ese formulario no hace parte de la guía." };
  }

  const marcado = formData.get("marcado") === "true";

  // Desmarcarlo dejaría una práctica finalizada con su entrega incompleta.
  const pasoFinal = PASOS_GUIA.find(
    (p) => p.avance === PASO_CON_REQUISITOS_OBLIGATORIOS
  );
  if (
    !marcado &&
    practica.avance === PASO_CON_REQUISITOS_OBLIGATORIOS &&
    pasoFinal?.requisitos.some((r) => r.id === formulario)
  ) {
    return {
      error:
        "Tu práctica está finalizada. Para desmarcarlo, primero vuelve al paso En curso.",
    };
  }

  const otros = practica.formularios_diligenciados.filter(
    (f) => f !== formulario
  );

  const { error } = await createAdminClient()
    .from("practicantes")
    .update({
      formularios_diligenciados: marcado ? [...otros, formulario] : otros,
    })
    .eq("id", practica.id);

  if (error) {
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }

  revalidatePath("/mi-practica");
  return {};
}

export async function guardarDatos(
  state: PortalState,
  formData: FormData
): Promise<PortalState> {
  const correo = await correoDeLaSesion();
  if (!correo) return { error: SESION_VENCIDA };

  const practica = await practicaDelCorreo(
    correo,
    String(formData.get("practicante_id") ?? "")
  );
  if (!practica) return { error: SIN_PERMISO };

  // Solo entran los campos que siguen vacíos: lo que ya está diligenciado en la
  // matriz lo corrige el docente, aunque manipulen el formulario.
  const cambios: Record<string, string | number> = {};
  for (const { campo } of CAMPOS_ESTUDIANTE) {
    const valor = String(formData.get(campo) ?? "").trim();
    if (valor && practica[campo] === null) cambios[campo] = valor;
  }

  if (Object.keys(cambios).length === 0) {
    return { error: "Escribe al menos un dato para guardar." };
  }

  if (
    cambios.programa_academico &&
    !PROGRAMAS_ACADEMICOS.includes(cambios.programa_academico as never)
  ) {
    return { error: "Selecciona un programa académico de la lista." };
  }
  if (cambios.semestre) {
    if (!SEMESTRES.includes(cambios.semestre as never)) {
      return { error: "Selecciona un semestre de la lista." };
    }
    cambios.semestre = Number(cambios.semestre);
  }
  if (cambios.modalidad && !MODALIDADES.includes(cambios.modalidad as never)) {
    return { error: "Selecciona una modalidad de la lista." };
  }
  for (const campo of ["fecha_inicio", "fecha_fin"] as const) {
    const valor = cambios[campo];
    if (valor && Number.isNaN(Date.parse(String(valor)))) {
      return { error: "Revisa las fechas: alguna no es válida." };
    }
  }

  const inicio = cambios.fecha_inicio ?? practica.fecha_inicio;
  const fin = cambios.fecha_fin ?? practica.fecha_fin;
  if (inicio && fin && String(fin) < String(inicio)) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  const { error } = await createAdminClient()
    .from("practicantes")
    .update(cambios)
    .eq("id", practica.id);

  if (error) {
    return { error: "No pudimos guardar tus datos. Intenta de nuevo." };
  }

  revalidatePath("/mi-practica");
  return { ok: "Tus datos quedaron guardados." };
}

export async function subirDocumento(
  state: PortalState,
  formData: FormData
): Promise<PortalState> {
  const correo = await correoDeLaSesion();
  if (!correo) return { error: SESION_VENCIDA };

  const practica = await practicaDelCorreo(
    correo,
    String(formData.get("practicante_id") ?? "")
  );
  if (!practica) return { error: SIN_PERMISO };

  const requisito = REQUISITOS_GUIA.find(
    (r) => r.id === String(formData.get("tipo_documento") ?? "")
  );
  if (!requisito) return { error: "Esa entrega no hace parte de la guía." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  if (archivo.size > TAMANO_MAXIMO_PORTAL_MB * 1024 * 1024) {
    return {
      error: `El archivo supera ${TAMANO_MAXIMO_PORTAL_MB} MB. Comprímelo o guárdalo en menor calidad.`,
    };
  }

  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES_PERMITIDAS.some((ext) => nombre.endsWith(ext))) {
    return { error: "Sube un PDF, una imagen o un documento de Office." };
  }
  if (
    requisito.tipo === "documento" &&
    requisito.soloPdf &&
    !nombre.endsWith(".pdf")
  ) {
    return { error: `${requisito.nombre} debe estar en formato PDF.` };
  }

  const carpeta = sanitizarNombre(practica.nombre_completo ?? "");
  if (!carpeta) {
    return {
      error: "Tu registro no tiene nombre. Pídele a tu docente que lo complete.",
    };
  }

  // Con el tipo en el nombre, el docente reconoce el archivo en su carpeta.
  const etiqueta = etiquetaSoporte(requisito);
  const nombreFinal = sanitizarNombre(`${etiqueta} - ${archivo.name}`);

  try {
    const registro = await subirADestinoDelDocente(
      practica.docente_id,
      carpeta,
      archivo,
      nombreFinal
    );

    if (!registro) {
      return {
        error:
          "Tu docente aún no ha activado la carpeta de documentos. Avísale para que la configure.",
      };
    }

    const { error } = await createAdminClient().from("soportes").insert({
      practicante_id: practica.id,
      docente_id: practica.docente_id,
      tipo_documento: requisito.id,
      subido_por: "estudiante",
      tipo_mime: archivo.type || null,
      carpeta,
      ...registro,
    });

    if (error) {
      console.error("Documento subido pero sin registrar:", error.message);
      return {
        error:
          "El archivo se subió, pero no pudimos registrarlo. Intenta de nuevo; si sigue fallando, avísale a tu docente.",
      };
    }
  } catch (error) {
    // Los mensajes del flujo le hablan al docente y hablan de su configuración.
    console.error("No se pudo subir el documento del estudiante:", error);
    return {
      error:
        "No pudimos guardar el archivo en la carpeta de tu docente. Intenta más tarde; si sigue fallando, avísale.",
    };
  }

  revalidatePath("/mi-practica");
  return { ok: `Recibido: ${etiqueta}.` };
}
