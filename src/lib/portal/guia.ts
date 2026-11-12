import { AVANCES } from "@/lib/constants";
import { Practicante } from "@/lib/types";

/**
 * Guía del portal del estudiante: las tres entregas oficiales de la práctica y
 * lo que se pide en cada una. Para cambiar lo que se pide solo se edita este
 * archivo. Los `id` quedan guardados en `soportes.tipo_documento` y en
 * `practicantes.formularios_diligenciados` y `practicantes.requisitos_recibidos`, así que no se deben renombrar una
 * vez haya entregas cargadas con ellos.
 */

export type Avance = (typeof AVANCES)[number];

export type RequisitoGuia = {
  id: string;
  nombre: string;
  ayuda: string;
} & (
  | { tipo: "documento"; soloPdf?: boolean }
  // El formulario se diligencia fuera de la app: el estudiante declara con un
  // check que ya lo hizo y puede adjuntar una evidencia.
  | { tipo: "formulario"; evidenciaObligatoria?: boolean }
);

export type PasoGuia = {
  avance: Avance;
  entrega: string;
  actividades: string[];
  requisitos: RequisitoGuia[];
};

export const PASOS_GUIA: PasoGuia[] = [
  {
    avance: "Inicio",
    entrega: "Primera entrega",
    actividades: [
      "Pre-diagnóstico y diagnóstico del área o departamento donde se aplicará la práctica.",
      "Planificación de la acción de mejora.",
      "Esquema general del plan de práctica.",
      "Reunión de inicio de la práctica con el empresario y el docente.",
    ],
    requisitos: [
      {
        id: "documento_inicial",
        tipo: "documento",
        soloPdf: true,
        nombre: "Documento de la primera entrega",
        ayuda: "En PDF, de acuerdo con los lineamientos del docente.",
      },
      {
        id: "cronograma",
        tipo: "documento",
        nombre: "Cronograma de trabajo",
        ayuda: "Conforme a los lineamientos del docente.",
      },
      {
        id: "formulario_inicio",
        tipo: "formulario",
        nombre: "Formulario de la empresa y el área",
        ayuda:
          "Información de la empresa o del área donde se desarrollará el plan de mejoramiento y su alcance.",
      },
      {
        id: "acta_inicio",
        tipo: "documento",
        nombre: "Acta de inicio de la práctica",
        ayuda:
          "Agenda una reunión con el empresario y el docente para presentar la propuesta de mejoramiento, que ambos deben aprobar.",
      },
    ],
  },
  {
    avance: "En curso",
    entrega: "Segunda entrega",
    actividades: [
      "Plan de trabajo con las evidencias del desarrollo de la propuesta de mejoramiento.",
      "Informe de avance de la práctica.",
    ],
    requisitos: [
      {
        id: "documento_avance",
        tipo: "documento",
        soloPdf: true,
        nombre: "Documento de avance",
        ayuda: "En PDF, de acuerdo con los lineamientos del docente.",
      },
      {
        id: "formulario_avance",
        tipo: "formulario",
        nombre: "Formulario de desarrollo de actividades",
        ayuda:
          "Detalla las actividades realizadas para cumplir el plan de trabajo y la medición de los impactos generados en la empresa.",
      },
    ],
  },
  {
    avance: "Finalizado",
    entrega: "Tercera entrega",
    actividades: [
      "Plan de trabajo final con las evidencias del desarrollo y aplicación de la propuesta de mejoramiento.",
      "Informe final de la práctica.",
      "Reunión final de sustentación del plan de mejoramiento.",
    ],
    requisitos: [
      {
        id: "documento_final",
        tipo: "documento",
        soloPdf: true,
        nombre: "Documento final",
        ayuda: "En PDF, de acuerdo con los lineamientos del docente.",
      },
      {
        id: "formulario_final",
        tipo: "formulario",
        evidenciaObligatoria: true,
        nombre: "Formulario de competencias e impacto",
        ayuda:
          "Evalúa las competencias blandas y específicas del programa y los indicadores de impacto del plan de práctica.",
      },
      {
        id: "acta_cierre",
        tipo: "documento",
        nombre: "Acta de cierre de la práctica",
        ayuda:
          "Agenda una reunión con el empresario y el docente para presentar los resultados de tu plan de mejoramiento.",
      },
    ],
  },
];

export const REQUISITOS_GUIA: RequisitoGuia[] = PASOS_GUIA.flatMap(
  (paso) => paso.requisitos
);

/** Paso que no se puede marcar hasta tener completa toda su entrega. */
export const PASO_CON_REQUISITOS_OBLIGATORIOS: Avance = "Finalizado";

/** Cómo se nombra el archivo de un requisito en las listas de soportes. */
export function etiquetaSoporte(requisito: RequisitoGuia): string {
  return requisito.tipo === "formulario"
    ? `Evidencia: ${requisito.nombre}`
    : requisito.nombre;
}

type SoporteGuia = { tipo_documento: string | null };

export type EstadoRequisito = {
  cumplido: boolean;
  /** El docente lo marcó como recibido (cuenta como cumplido sin archivo). */
  recibido: boolean;
  /** Solo formularios: el estudiante marcó el check. */
  diligenciado: boolean;
  tieneArchivo: boolean;
};

export function estadoRequisito(
  requisito: RequisitoGuia,
  formularios: string[],
  soportes: SoporteGuia[],
  recibidos: string[] = []
): EstadoRequisito {
  const tieneArchivo = soportes.some((s) => s.tipo_documento === requisito.id);
  const recibido = (recibidos ?? []).includes(requisito.id);

  if (requisito.tipo === "documento") {
    return {
      cumplido: recibido || tieneArchivo,
      recibido,
      diligenciado: false,
      tieneArchivo,
    };
  }

  const diligenciado = formularios.includes(requisito.id);
  return {
    cumplido:
      recibido ||
      (diligenciado && (!requisito.evidenciaObligatoria || tieneArchivo)),
    recibido,
    diligenciado,
    tieneArchivo,
  };
}

/** Lo que le falta a una entrega. */
export function requisitosPendientes(
  avance: Avance,
  formularios: string[],
  soportes: SoporteGuia[],
  recibidos: string[] = []
): RequisitoGuia[] {
  const paso = PASOS_GUIA.find((p) => p.avance === avance);

  return (paso?.requisitos ?? []).filter(
    (r) => !estadoRequisito(r, formularios, soportes, recibidos).cumplido
  );
}

/** Campos de la matriz que el estudiante puede llenar si están vacíos. */
export const CAMPOS_ESTUDIANTE = [
  { campo: "numero_documento", etiqueta: "N° de documento" },
  { campo: "programa_academico", etiqueta: "Programa académico" },
  { campo: "semestre", etiqueta: "Semestre" },
  { campo: "empresa", etiqueta: "Empresa" },
  { campo: "modalidad", etiqueta: "Modalidad" },
  { campo: "fecha_inicio", etiqueta: "Fecha de inicio" },
  { campo: "fecha_fin", etiqueta: "Fecha de fin" },
  { campo: "tutor_empresa", etiqueta: "Tutor de empresa" },
] as const;

export type CampoEstudiante = (typeof CAMPOS_ESTUDIANTE)[number]["campo"];

export type Completitud = {
  datos: { hechos: number; total: number };
  entregables: { hechos: number; total: number };
};

export function calcularCompletitud(
  practicante: Pick<
    Practicante,
    CampoEstudiante | "formularios_diligenciados" | "requisitos_recibidos"
  >,
  soportes: SoporteGuia[] = []
): Completitud {
  return {
    datos: {
      hechos: CAMPOS_ESTUDIANTE.filter(({ campo }) => {
        const valor = practicante[campo];
        return valor !== null && valor !== undefined && valor !== "";
      }).length,
      total: CAMPOS_ESTUDIANTE.length,
    },
    entregables: {
      hechos: REQUISITOS_GUIA.filter(
        (r) =>
          estadoRequisito(
            r,
            practicante.formularios_diligenciados,
            soportes,
            practicante.requisitos_recibidos
          ).cumplido
      ).length,
      total: REQUISITOS_GUIA.length,
    },
  };
}
