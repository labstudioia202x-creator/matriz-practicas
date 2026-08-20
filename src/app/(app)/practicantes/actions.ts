"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  PROGRAMAS_ACADEMICOS,
  SEMESTRES,
  MODALIDADES,
  ESTADOS,
} from "@/lib/constants";

export type FormState = { error?: string } | undefined;

function texto(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function fecha(formData: FormData, campo: string): string | null {
  const valor = String(formData.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

export async function guardarPracticante(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const nombre = texto(formData, "nombre_completo");
  const programa = texto(formData, "programa_academico");
  const semestreRaw = String(formData.get("semestre") ?? "").trim();
  const modalidad = texto(formData, "modalidad");
  const estado = texto(formData, "estado");
  const motivo = texto(formData, "motivo_reprobacion");

  if (!nombre) {
    return { error: "El nombre completo es obligatorio." };
  }
  if (programa && !PROGRAMAS_ACADEMICOS.includes(programa as never)) {
    return { error: "Selecciona un programa académico válido." };
  }
  if (semestreRaw && !SEMESTRES.includes(semestreRaw as never)) {
    return { error: "Selecciona un semestre válido." };
  }
  if (modalidad && !MODALIDADES.includes(modalidad as never)) {
    return { error: "Selecciona una modalidad válida." };
  }
  if (estado && !ESTADOS.includes(estado as never)) {
    return { error: "Selecciona un estado válido." };
  }
  if (estado === "Reprobado" && !motivo) {
    return {
      error: "Si el estado es Reprobado, debes diligenciar el motivo de reprobación.",
    };
  }

  const entrada = {
    nombre_completo: nombre,
    numero_documento: texto(formData, "numero_documento"),
    programa_academico: programa,
    semestre: semestreRaw === "" ? null : Number(semestreRaw),
    correo_electronico: texto(formData, "correo_electronico"),
    empresa: texto(formData, "empresa"),
    modalidad,
    fecha_inicio: fecha(formData, "fecha_inicio"),
    fecha_fin: fecha(formData, "fecha_fin"),
    tutor_empresa: texto(formData, "tutor_empresa"),
    estado,
    motivo_reprobacion: motivo,
    observaciones: texto(formData, "observaciones"),
  };

  const id = String(formData.get("id") ?? "");

  if (id) {
    const { error } = await supabase
      .from("practicantes")
      .update(entrada)
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("practicantes")
      .insert({ ...entrada, docente_id: user.id });

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/practicantes");
  revalidatePath("/dashboard");
  redirect("/practicantes");
}

export async function eliminarPracticante(
  state: FormState,
  formData: FormData
): Promise<FormState> {
  const supabase = await createClient();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return { error: "No se pudo identificar el practicante." };
  }

  const { error } = await supabase.from("practicantes").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/practicantes");
  revalidatePath("/dashboard");
  return {};
}