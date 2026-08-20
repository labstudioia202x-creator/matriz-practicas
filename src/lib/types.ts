export interface Practicante {
  id: string;
  docente_id: string;
  nombre_completo: string | null;
  numero_documento: string | null;
  programa_academico: string | null;
  semestre: number | null;
  correo_electronico: string | null;
  empresa: string | null;
  modalidad: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  tutor_empresa: string | null;
  estado: string | null;
  motivo_reprobacion: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "docente" | "admin";
}

export interface PracticanteConDocente extends Practicante {
  docente: Pick<Profile, "full_name" | "email"> | null;
}