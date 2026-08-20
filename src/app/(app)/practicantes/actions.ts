"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import {
  PRACTICAS,
  PROGRAMAS_ACADEMICOS,
  SEMESTRES,
  MODALIDADES,
  ESTADOS,
} from "@/lib/constants";

export type FormState = { error?: string } | undefined;

export type CargaResult =
  | { creados: number; errores: string[] }
  | { error: string };

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
  const practica = texto(formData, "practica");
  const programa = texto(formData, "programa_academico");
  const semestreRaw = String(formData.get("semestre") ?? "").trim();
  const modalidad = texto(formData, "modalidad");
  const estado = texto(formData, "estado");
  const motivo = texto(formData, "motivo_reprobacion");

  if (!nombre) {
    return { error: "El nombre completo es obligatorio." };
  }
  if (!practica) {
    return { error: "Debes indicar la práctica (I, II o III) del practicante." };
  }
  if (!PRACTICAS.includes(practica as never)) {
    return { error: "Selecciona una práctica válida." };
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
    practica,
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

// ---------------------------------------------------------------------------
// CARGUE MASIVO DESDE EXCEL
// ---------------------------------------------------------------------------

function celdaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    const anio = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const dia = String(valor.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
  }
  if (typeof valor === "number") {
    return String(valor);
  }
  const texto = String(valor).trim();
  // Fechas en formato dd/mm/aaaa o dd/mm/aa -> aaaa-mm-dd
  const coincidencia = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (coincidencia) {
    const anio = coincidencia[3].length === 2 ? `20${coincidencia[3]}` : coincidencia[3];
    return `${anio}-${coincidencia[2].padStart(2, "0")}-${coincidencia[1].padStart(2, "0")}`;
  }
  return texto;
}

function esFechaIso(valor: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(valor);
}

export async function cargarPracticantes(
  state: CargaResult | undefined,
  formData: FormData
): Promise<CargaResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { error: "Selecciona un archivo Excel (.xlsx) para cargar." };
  }
  if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "El archivo debe tener formato .xlsx (descarga la plantilla)." };
  }

  let workbook: ExcelJS.Workbook;
  try {
    const buffer = await archivo.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
  } catch {
    return {
      error: "No se pudo leer el archivo. Asegúrate de que sea un Excel .xlsx válido.",
    };
  }

  const hoja = workbook.worksheets[0];
  if (!hoja) {
    return { error: "El archivo no contiene hojas de cálculo." };
  }

  // 1) Validar encabezados (esperamos la plantilla descargada desde el sitio)
  const filaUno = hoja.getRow(1).values as unknown[];
  const encabezadoPractica = String(filaUno?.[2] ?? "").trim().toLowerCase();
  const encabezadoNombre = String(filaUno?.[3] ?? "").trim().toLowerCase();
  if (
    !encabezadoPractica.includes("práctica") ||
    !encabezadoNombre.includes("nombre completo")
  ) {
    return {
      error:
        "El archivo no tiene el formato de la plantilla. Descarga la plantilla y vuelve a intentarlo.",
    };
  }

  // 2) Documentos ya registrados por este docente (para evitar duplicados)
  const { data: existentes } = await supabase
    .from("practicantes")
    .select("numero_documento")
    .eq("docente_id", user.id);
  const documentosExistentes = new Set(
    (existentes ?? [])
      .map((p) => p.numero_documento)
      .filter((d): d is string => !!d)
  );

  const registros: Array<Record<string, unknown>> = [];
  const errores: string[] = [];
  const documentosEnArchivo = new Set<string>();

  // 3) Recorrer filas (la 1 es el encabezado)
  hoja.eachRow((fila, numeroFila) => {
    if (numeroFila === 1) return;
    const valores = fila.values as unknown[];
    const esVacia = valores
      .slice(1, 16)
      .every((v) => v === null || v === undefined || String(v).trim() === "");
    if (esVacia) return;

    const mensajeFila = `Fila ${numeroFila}`;
    const nombre = celdaTexto(valores[3]);
    const practica = celdaTexto(valores[2]);
    const documento = celdaTexto(valores[4]);
    const programa = celdaTexto(valores[5]);
    const semestreTexto = celdaTexto(valores[6]);
    const correo = celdaTexto(valores[7]);
    const empresa = celdaTexto(valores[8]);
    const modalidad = celdaTexto(valores[9]);
    const fechaInicio = celdaTexto(valores[10]);
    const fechaFin = celdaTexto(valores[11]);
    const tutor = celdaTexto(valores[12]);
    const estado = celdaTexto(valores[13]);
    const motivo = celdaTexto(valores[14]);
    const observaciones = celdaTexto(valores[15]);

    const erroresFila: string[] = [];

    if (!nombre) {
      erroresFila.push("el nombre completo es obligatorio");
    }
    if (practica && !PRACTICAS.includes(practica as never)) {
      erroresFila.push(
        `'${practica}' no es una práctica válida (usa Prácticas I, II o III)`
      );
    }
    if (programa && !PROGRAMAS_ACADEMICOS.includes(programa as never)) {
      erroresFila.push("el programa académico no está en la lista permitida");
    }

    let semestre: number | null = null;
    if (semestreTexto) {
      semestre = Number.parseInt(semestreTexto, 10);
      if (
        Number.isNaN(semestre) ||
        !SEMESTRES.includes(String(semestre) as never)
      ) {
        erroresFila.push("el semestre debe ser un número entre 4 y 10");
      }
    }

    if (modalidad && !MODALIDADES.includes(modalidad as never)) {
      erroresFila.push("la modalidad no está en la lista permitida");
    }
    if (estado && !ESTADOS.includes(estado as never)) {
      erroresFila.push("el estado no está en la lista permitida");
    }
    if (estado === "Reprobado" && !motivo) {
      erroresFila.push(
        "el estado es Reprobado y falta el motivo de reprobación"
      );
    }
    if (fechaInicio && !esFechaIso(fechaInicio)) {
      erroresFila.push("la fecha de inicio no tiene un formato válido");
    }
    if (fechaFin && !esFechaIso(fechaFin)) {
      erroresFila.push("la fecha de fin no tiene un formato válido");
    }
    if (documento && documentosEnArchivo.has(documento)) {
      erroresFila.push("el documento ya aparece en otra fila del archivo");
    }
    if (documento && documentosExistentes.has(documento)) {
      erroresFila.push("el documento ya estaba registrado en tu lista");
    }

    if (erroresFila.length > 0) {
      errores.push(`${mensajeFila}: ${erroresFila.join("; ")}.`);
      return;
    }

    documentosEnArchivo.add(documento);
    documentosExistentes.add(documento);

    registros.push({
      docente_id: user.id,
      practica: practica || null,
      nombre_completo: nombre || null,
      numero_documento: documento || null,
      programa_academico: programa || null,
      semestre,
      correo_electronico: correo || null,
      empresa: empresa || null,
      modalidad: modalidad || null,
      fecha_inicio: fechaInicio || null,
      fecha_fin: fechaFin || null,
      tutor_empresa: tutor || null,
      estado: estado || null,
      motivo_reprobacion: motivo || null,
      observaciones: observaciones || null,
    });
  });

  if (registros.length === 0) {
    if (errores.length > 0) {
      return { creados: 0, errores };
    }
    return { error: "El archivo no tiene datos para cargar." };
  }

  const { error } = await supabase.from("practicantes").insert(registros);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/practicantes");
  revalidatePath("/dashboard");

  return { creados: registros.length, errores };
}