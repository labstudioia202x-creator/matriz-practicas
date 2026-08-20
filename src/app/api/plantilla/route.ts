import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  PRACTICAS,
  PROGRAMAS_ACADEMICOS,
  SEMESTRES,
  MODALIDADES,
  ESTADOS,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Practicantes");

  sheet.columns = [
    { key: "numero", width: 6 },
    { key: "practica", width: 14 },
    { key: "nombre", width: 34 },
    { key: "documento", width: 14 },
    { key: "programa", width: 44 },
    { key: "semestre", width: 9 },
    { key: "correo", width: 30 },
    { key: "empresa", width: 26 },
    { key: "modalidad", width: 22 },
    { key: "fechaInicio", width: 12 },
    { key: "fechaFin", width: 12 },
    { key: "tutor", width: 24 },
    { key: "estado", width: 14 },
    { key: "motivo", width: 32 },
    { key: "observaciones", width: 38 },
  ];

  const borde = {
    top: { style: "thin" as const, color: { argb: "FF9CA3AF" } },
    left: { style: "thin" as const, color: { argb: "FF9CA3AF" } },
    bottom: { style: "thin" as const, color: { argb: "FF9CA3AF" } },
    right: { style: "thin" as const, color: { argb: "FF9CA3AF" } },
  };

  // Fila 1: encabezados (el cargue masivo espera los títulos aquí)
  const titulares = [
    "N°",
    "Práctica *",
    "Nombre Completo *",
    "N° Documento",
    "Programa Académico",
    "Semestre",
    "Correo Electrónico",
    "Empresa",
    "Modalidad",
    "Fecha Inicio",
    "Fecha Fin",
    "Tutor Empresa",
    "Estado",
    "Motivo de Reprobación",
    "Observaciones",
  ];
  const headerRow = sheet.getRow(1);
  titulares.forEach((titulo, idx) => {
    const celda = headerRow.getCell(idx + 1);
    celda.value = titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0054A6" } };
    celda.border = borde;
  });
  sheet.getRow(1).height = 28;

  // Fila 2: ejemplo ilustrativo (se puede borrar antes de cargar)
  const ejemplo = sheet.getRow(2);
  ejemplo.values = [
    1,
    "Prácticas I",
    "Ejemplo Pérez Gómez",
    "1010123456",
    "Profesional en Ingeniería de Software",
    8,
    "ejemplo@correo.com",
    "Empresa Ejemplo S.A.S.",
    "Contrato de aprendizaje",
    new Date(2026, 7, 1),
    new Date(2026, 10, 30),
    "Nombre del tutor",
    "Vinculado",
    "",
    "",
  ];
  ejemplo.alignment = { vertical: "top", wrapText: true };
  ejemplo.eachCell((celda) => {
    celda.border = borde;
    celda.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF7E6" },
    };
  });
  ejemplo.getCell(10).numFmt = "dd/mm/yyyy";
  ejemplo.getCell(11).numFmt = "dd/mm/yyyy";

  // Validaciones de datos en las filas 2..101
  const validaciones: Array<{ col: string; valores: readonly string[] }> = [
    { col: "B", valores: PRACTICAS },
    { col: "E", valores: PROGRAMAS_ACADEMICOS },
    { col: "F", valores: SEMESTRES },
    { col: "I", valores: MODALIDADES },
    { col: "M", valores: ESTADOS },
  ];
  const PRIMERA = 2;
  const ULTIMA = 101;

  validaciones.forEach(({ col, valores }) => {
    for (let fila = PRIMERA; fila <= ULTIMA; fila++) {
      sheet.getCell(`${col}${fila}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${valores.join(",")}"`],
      };
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "O1" };

  // Hoja de instrucciones
  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ key: "texto", width: 110 }];
  const filasInstrucciones = [
    ["PLANTILLA DE CARGUE MASIVO DE PRACTICANTES – UCOMPENSAR"],
    [""],
    ["1. Completa una fila por estudiante. NO modifiques los títulos de la primera fila."],
    ["2. La columna B (Práctica) indica la práctica del estudiante: Prácticas I, Prácticas II o Prácticas III."],
    ["3. Nombre Completo (C) y Práctica (B) son obligatorios. El resto puede dejarse vacío si aún no tienes el dato."],
    ["4. Programa, Semestre, Modalidad, Estado y Práctica tienen lista desplegable: usa solo los valores permitidos."],
    ["5. Si el Estado es 'Reprobado', diligenciar obligatoriamente el Motivo de Reprobación."],
    ["6. Las fechas deben escribirse en formato dd/mm/aaaa."],
    ["7. La fila 2 contiene un ejemplo. Bórrala antes de cargar tu archivo."],
    ["8. Guarda el archivo en formato .xlsx y súbelo en el sitio en: Mis practicantes → Cargar desde Excel."],
    [""],
    ["CONTACTO DE SOPORTE: Unidad de Prácticas – Ingeniería de Software."],
  ];
  filasInstrucciones.forEach(([texto], i) => {
    const celda = instrucciones.getCell(`A${i + 1}`);
    celda.value = texto;
    if (i === 0) {
      celda.font = { bold: true, size: 13, color: { argb: "FF0054A6" } };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const nombreArchivo = "Plantilla_Cargue_Practicantes_UCompensar.xlsx";

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}