export interface Practicante {
  id: string;
  docente_id: string;
  practica: string | null;
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
export interface Soporte {
  id: string;
  practicante_id: string;
  docente_id: string;
  nombre_archivo: string;
  descripcion: string | null;
  tamano_bytes: number | null;
  tipo_mime: string | null;
  carpeta: string | null;
  sharepoint_item_id: string | null;
  web_url: string | null;
  destino: "microsoft" | "power_automate";
  subido_en: string;
}

export interface Comunicacion {
  id: string;
  docente_id: string;
  asunto: string;
  mensaje: string;
  canales: ("teams" | "correo")[];
  total_destinatarios: number;
  creado_en: string;
}

export interface ComunicacionEnvio {
  id: string;
  comunicacion_id: string;
  practicante_id: string | null;
  nombre: string | null;
  correo: string | null;
  canal: "teams" | "correo";
  estado: "enviado" | "fallido" | "omitido";
  error: string | null;
  enviado_en: string;
}
