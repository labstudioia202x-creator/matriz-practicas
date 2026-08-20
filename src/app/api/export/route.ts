import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  PERIODO_SEGUIMIENTO,
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return new Response("No autorizado", { status: 403 });
  }

  const { data: practicantes, error } = await supabase
    .from("practicantes")
    .select("*, docente:profiles!docente_id(full_name, email)")
    .order("created_at", { ascending: true });

  if (error) {
    return new Response("Error al consultar los datos", { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("matriz");

  sheet.columns = [
    { key: "numero", width: 6 },
    { key: "nombre", width: 32 },
    { key: "documento", width: 14 },
    { key: "programa", width: 42 },
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

  // Fila 1: Título general
  sheet.mergeCells("A1:N1");
  const titulo = sheet.getCell("A1");
  titulo.value = "INFORME DE PRACTICANTES – UCOMPENSAR";
  titulo.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  titulo.alignment = { horizontal: "center", vertical: "middle" };
  titulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0054A6" } };
  sheet.getRow(1).height = 24;

  // Fila 2: Período
  sheet.mergeCells("A2:N2");
  const periodo = sheet.getCell("A2");
  periodo.value = `Período de seguimiento ${PERIODO_SEGUIMIENTO}`;
  periodo.font = { bold: true, color: { argb: "FF0054A6" } };
  periodo.alignment = { horizontal: "center", vertical: "middle" };
  periodo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE9F7" } };
  sheet.getRow(2).height = 20;

  // Fila 3: Encabezados de sección
  sheet.mergeCells("A3:F3");
  sheet.mergeCells("G3:K3");
  sheet.mergeCells("L3:N3");
  const secciones = [
    { cell: "A3", texto: "DATOS DEL PRACTICANTE" },
    { cell: "G3", texto: "INFORMACIÓN DE VINCULACIÓN" },
    { cell: "L3", texto: "SEGUIMIENTO" },
  ];
  secciones.forEach(({ cell, texto }) => {
    const c = sheet.getCell(cell);
    c.value = texto;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF003B73" } };
  });
  sheet.getRow(3).height = 20;

  // Fila 4: Titulares de columna
  const titulares = [
    "N°",
    "Nombre Completo",
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
  const headerRow = sheet.getRow(4);
  titulares.forEach((titulo, idx) => {
    const celda = headerRow.getCell(idx + 1);
    celda.value = titulo;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0054A6" } };
    celda.border = borde;
  });
  sheet.getRow(4).height = 28;

  // Datos
  const FILA_INICIO = 5;
  practicantes?.forEach((p, i) => {
    const fila = sheet.getRow(FILA_INICIO + i);
    fila.values = [
      i + 1,
      p.nombre_completo ?? "",
      p.numero_documento ?? "",
      p.programa_academico ?? "",
      p.semestre ?? "",
      p.correo_electronico ?? "",
      p.empresa ?? "",
      p.modalidad ?? "",
      p.fecha_inicio ?? "",
      p.fecha_fin ?? "",
      p.tutor_empresa ?? "",
      p.estado ?? "",
      p.motivo_reprobacion ?? "",
      p.observaciones ?? "",
    ];
    fila.alignment = { vertical: "top", wrapText: true };
    fila.eachCell((celda) => {
      celda.border = borde;
    });
    if (i % 2 === 1) {
      fila.eachCell((celda) => {
        celda.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF1F5F9" },
        };
      });
    }
  });

  // Validaciones de datos (listas desplegables iguales a la matriz original)
  const ultimaFila = FILA_INICIO + (practicantes?.length ?? 0) - 1;
  if (practicantes && practicantes.length > 0) {
    const validaciones: Array<{ col: string; valores: readonly string[] }> = [
      { col: "D", valores: PROGRAMAS_ACADEMICOS },
      { col: "E", valores: SEMESTRES },
      { col: "H", valores: MODALIDADES },
      { col: "L", valores: ESTADOS },
    ];

    validaciones.forEach(({ col, valores }) => {
      for (let fila = FILA_INICIO; fila <= ultimaFila; fila++) {
        sheet.getCell(`${col}${fila}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${valores.join(",")}"`],
        };
      }
    });
  }

  // Fechas como fechas reales de Excel
  (["I", "J"] as const).forEach((col) => {
    for (let fila = FILA_INICIO; fila <= ultimaFila; fila++) {
      const celda = sheet.getCell(`${col}${fila}`);
      const valor = celda.value as string;
      if (valor && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        const fecha = new Date(`${valor}T00:00:00`);
        celda.value = fecha;
        celda.numFmt = "dd/mm/yyyy";
      }
    }
  });

  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.autoFilter = {
    from: "A4",
    to: "N4",
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const nombreArchivo = "Matriz_Seguimiento_Practicas_UCompensar.xlsx";

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    },
  });
}