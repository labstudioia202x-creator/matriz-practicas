export const PRACTICAS = [
  "Prácticas I",
  "Prácticas II",
  "Prácticas III",
] as const;

export const PROGRAMAS_ACADEMICOS = [
  "Técnica Profesional en Programación de Aplicaciones de Software",
  "Tecnología en Desarrollo de Aplicaciones Web y Móviles",
  "Profesional en Ingeniería de Software",
] as const;

export const SEMESTRES = ["4", "5", "6", "7", "8", "9", "10"] as const;

export const MODALIDADES = [
  "Contrato laboral",
  "Contrato de aprendizaje",
  "Convenio",
  "Social comunitaria",
  "Emprendimiento",
  "Consultoría",
] as const;

export const ESTADOS = [
  "Vinculado",
  "No Iniciado",
  "Reprobado",
  "Ausente",
  "No vinculado",
  "Aprobado",
] as const;

// Paso de la práctica que reporta el estudiante en su portal. Es distinto de
// ESTADOS, que es el resultado oficial que define el docente.
export const AVANCES = ["Inicio", "En curso", "Finalizado"] as const;

export const DOMINIO_UCOMPENSAR = "ucompensar.edu.co";

export const PERIODO_SEGUIMIENTO = "2026 - 2";
// Tope de tamaño por soporte subido a SharePoint.
export const TAMANO_MAXIMO_SOPORTE_MB = 20;
// En el portal del estudiante el tope es menor: Vercel corta el cuerpo de la
// petición cerca de los 4.5 MB, y así el estudiante recibe un mensaje claro en
// lugar de un error genérico.
export const TAMANO_MAXIMO_PORTAL_MB = 4;
