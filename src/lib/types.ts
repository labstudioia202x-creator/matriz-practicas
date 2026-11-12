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
  avance: string | null;
  avance_actualizado_en: string | null;
  formularios_diligenciados: string[];
  // Entregables que el docente marcó como recibidos (ids de la guía).
  requisitos_recibidos: string[];
  // Sigue en el intersemestral (marca del docente, aparte de estado y avance).
  intersemestral: boolean;
  // Registro de prueba: no cuenta en los contadores ni sale en el Excel.
  prueba: boolean;
  created_at: string;
  updated_at: string;
}

/** Practicante con los archivos entregados, para medir completitud. */
export interface PracticanteConDocumentos extends Practicante {
  soportes?: { tipo_documento: string | null }[];
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: "docente" | "admin" | "estudiante";
}

export interface PracticanteConDocente extends PracticanteConDocumentos {
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
  tipo_documento: string | null;
  subido_por: "docente" | "estudiante";
  subido_en: string;
}

export interface Comunicacion {
  id: string;
  docente_id: string;
  asunto: string;
  mensaje: string;
  canales: ("teams" | "correo")[];
  destinatarios: string[];
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
