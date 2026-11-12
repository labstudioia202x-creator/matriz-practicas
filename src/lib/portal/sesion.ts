import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Practicante } from "@/lib/types";

/**
 * Acceso a los datos del portal del estudiante.
 *
 * El estudiante no tiene políticas RLS sobre `practicantes`, porque con RLS no se
 * puede limitar qué columnas cambia: con su propia sesión podría aprobarse a sí
 * mismo. Por eso todo pasa por aquí, con la service_role, filtrando siempre por
 * el correo verificado de la sesión y con una lista cerrada de columnas.
 * `estado`, `motivo_reprobacion` y `observaciones` son del docente y no se leen.
 */
const COLUMNAS_PORTAL =
  "id, docente_id, practica, nombre_completo, numero_documento, programa_academico, semestre, correo_electronico, empresa, modalidad, fecha_inicio, fecha_fin, tutor_empresa, avance, avance_actualizado_en, formularios_diligenciados, requisitos_recibidos, created_at";

export type PracticaPortal = Pick<
  Practicante,
  | "id"
  | "docente_id"
  | "practica"
  | "nombre_completo"
  | "numero_documento"
  | "programa_academico"
  | "semestre"
  | "correo_electronico"
  | "empresa"
  | "modalidad"
  | "fecha_inicio"
  | "fecha_fin"
  | "tutor_empresa"
  | "avance"
  | "avance_actualizado_en"
  | "formularios_diligenciados"
  | "requisitos_recibidos"
  | "created_at"
>;

/** Correo verificado de la sesión actual; null si no hay sesión. */
export async function correoDeLaSesion(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.email ? user.email.trim().toLowerCase() : null;
}

export async function practicasDelCorreo(
  correo: string
): Promise<PracticaPortal[]> {
  const { data, error } = await createAdminClient()
    .from("practicantes")
    .select(COLUMNAS_PORTAL)
    .eq("correo_normalizado", correo)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []) as PracticaPortal[];
}

/** La práctica indicada, solo si le pertenece a ese correo. */
export async function practicaDelCorreo(
  correo: string,
  id: string
): Promise<PracticaPortal | null> {
  const { data } = await createAdminClient()
    .from("practicantes")
    .select(COLUMNAS_PORTAL)
    .eq("id", id)
    .eq("correo_normalizado", correo)
    .maybeSingle();

  return (data as PracticaPortal | null) ?? null;
}
