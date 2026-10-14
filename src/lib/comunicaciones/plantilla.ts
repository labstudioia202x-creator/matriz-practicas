import { Practicante } from "@/lib/types";
import { DOMINIO_UCOMPENSAR } from "@/lib/constants";

// Funciones puras: se usan en el servidor para enviar y en el navegador para
// la vista previa, así lo que ve el docente es exactamente lo que se envía.

export const CANALES = ["teams", "correo"] as const;
export type Canal = (typeof CANALES)[number];

export const ETIQUETA_CANAL: Record<Canal, string> = {
  teams: "Teams",
  correo: "Correo",
};

type DatosPlantilla = Pick<
  Practicante,
  | "nombre_completo"
  | "practica"
  | "empresa"
  | "estado"
  | "programa_academico"
  | "tutor_empresa"
  | "fecha_inicio"
  | "fecha_fin"
>;

export const VARIABLES: {
  clave: string;
  descripcion: string;
  valor: (p: DatosPlantilla, docente: string) => string | null;
}[] = [
  { clave: "nombre", descripcion: "Nombre completo", valor: (p) => p.nombre_completo },
  { clave: "practica", descripcion: "Práctica", valor: (p) => p.practica },
  { clave: "empresa", descripcion: "Empresa", valor: (p) => p.empresa },
  { clave: "estado", descripcion: "Estado", valor: (p) => p.estado },
  { clave: "programa", descripcion: "Programa", valor: (p) => p.programa_academico },
  { clave: "tutor", descripcion: "Tutor empresa", valor: (p) => p.tutor_empresa },
  { clave: "fecha_inicio", descripcion: "Fecha inicio", valor: (p) => p.fecha_inicio },
  { clave: "fecha_fin", descripcion: "Fecha fin", valor: (p) => p.fecha_fin },
  { clave: "docente", descripcion: "Tu nombre", valor: (_, docente) => docente },
];

/** Reemplaza {variable} por el dato del practicante. Las desconocidas se dejan. */
export function personalizar(
  plantilla: string,
  practicante: DatosPlantilla,
  docente: string
): string {
  return plantilla.replace(/\{(\w+)\}/g, (original, clave: string) => {
    const variable = VARIABLES.find((v) => v.clave === clave.toLowerCase());
    if (!variable) return original;
    return variable.valor(practicante, docente) ?? "";
  });
}

export function escaparHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto plano del textarea → HTML seguro para Outlook y Teams. */
export function textoAHtml(texto: string): string {
  return escaparHtml(texto.trim())
    .replace(
      /https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
      (url) => `<a href="${url}">${url}</a>`
    )
    .split(/\n{2,}/)
    .map((parrafo) => `<p>${parrafo.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Teams solo llega a cuentas del tenant de la universidad. */
export function admiteTeams(correo: string | null): boolean {
  return Boolean(
    correo && correo.trim().toLowerCase().endsWith(`@${DOMINIO_UCOMPENSAR}`)
  );
}

export function correoValido(correo: string | null): boolean {
  return Boolean(correo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()));
}
