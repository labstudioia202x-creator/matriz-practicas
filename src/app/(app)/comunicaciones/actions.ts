"use server";

import { createClient } from "@/lib/supabase/server";
import {
  enviarPorFlujo,
  obtenerUrlFlujoComunicaciones,
} from "@/lib/comunicaciones/flujo";
import {
  CANALES,
  Canal,
  admiteTeams,
  correoValido,
  escaparHtml,
  personalizar,
  textoAHtml,
} from "@/lib/comunicaciones/plantilla";
import { Practicante } from "@/lib/types";

export type ResultadoEnvio = {
  practicanteId: string;
  nombre: string;
  canal: Canal;
  estado: "enviado" | "fallido" | "omitido";
  error: string | null;
};

// El navegador manda los destinatarios por lotes pequeños para mostrar el
// avance y no chocar con el tiempo máximo de la función en Vercel.
const TAMANO_MAXIMO_LOTE = 10;
const ENVIOS_SIMULTANEOS = 4;

/** Registra la comunicación y devuelve su id; el envío va en `enviarLote`. */
export async function crearComunicacion(datos: {
  asunto: string;
  mensaje: string;
  canales: Canal[];
  totalDestinatarios: number;
}): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  const asunto = datos.asunto.trim();
  const mensaje = datos.mensaje.trim();
  const canales = CANALES.filter((c) => datos.canales.includes(c));

  if (!asunto) return { error: "Escribe el asunto." };
  if (!mensaje) return { error: "Escribe el mensaje." };
  if (canales.length === 0) return { error: "Elige al menos un canal." };
  if (datos.totalDestinatarios < 1) {
    return { error: "Selecciona al menos un estudiante." };
  }

  if (!(await obtenerUrlFlujoComunicaciones(user.id))) {
    return {
      error:
        "Aún no has configurado el flujo de comunicaciones. Hazlo en Configuración.",
    };
  }

  const { data, error } = await supabase
    .from("comunicaciones")
    .insert({
      docente_id: user.id,
      asunto,
      mensaje,
      canales,
      total_destinatarios: datos.totalDestinatarios,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

/**
 * Personaliza y envía la comunicación a un lote de practicantes. Es
 * idempotente: lo que ya quedó "enviado" no se repite, así que sirve también
 * para reintentar los fallidos.
 */
export async function enviarLote(
  comunicacionId: string,
  practicanteIds: string[]
): Promise<{ resultados?: ResultadoEnvio[]; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

  if (practicanteIds.length === 0) return { resultados: [] };
  if (practicanteIds.length > TAMANO_MAXIMO_LOTE) {
    return { error: `Máximo ${TAMANO_MAXIMO_LOTE} estudiantes por lote.` };
  }

  const { data: comunicacion } = await supabase
    .from("comunicaciones")
    .select("asunto, mensaje, canales")
    .eq("id", comunicacionId)
    .eq("docente_id", user.id)
    .maybeSingle();

  if (!comunicacion) return { error: "No se encontró la comunicación." };

  const urlFlujo = await obtenerUrlFlujoComunicaciones(user.id);
  if (!urlFlujo) {
    return { error: "El flujo de comunicaciones ya no está configurado." };
  }

  const [{ data: perfil }, { data: practicantes }, { data: previos }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("practicantes")
        .select("*")
        .eq("docente_id", user.id)
        .in("id", practicanteIds),
      supabase
        .from("comunicacion_envios")
        .select("practicante_id, canal")
        .eq("comunicacion_id", comunicacionId)
        .eq("estado", "enviado")
        .in("practicante_id", practicanteIds),
    ]);

  const docente = perfil?.full_name || perfil?.email || "";
  const yaEnviados = new Set(
    (previos ?? []).map((e) => `${e.practicante_id}:${e.canal}`)
  );

  const tareas: (() => Promise<ResultadoEnvio>)[] = [];

  for (const p of (practicantes ?? []) as Practicante[]) {
    const nombre = p.nombre_completo || "(sin nombre)";
    const correo = p.correo_electronico?.trim() ?? "";
    const asunto = personalizar(comunicacion.asunto, p, docente);
    const cuerpo = textoAHtml(personalizar(comunicacion.mensaje, p, docente));

    for (const canal of comunicacion.canales as Canal[]) {
      if (yaEnviados.has(`${p.id}:${canal}`)) continue;

      const base = { practicanteId: p.id, nombre, canal };

      if (!correoValido(correo)) {
        tareas.push(async () => ({
          ...base,
          estado: "omitido",
          error: "No tiene un correo válido registrado.",
        }));
        continue;
      }

      if (canal === "teams" && !admiteTeams(correo)) {
        tareas.push(async () => ({
          ...base,
          estado: "omitido",
          error: "Teams solo llega a correos institucionales @ucompensar.edu.co.",
        }));
        continue;
      }

      // En Teams no hay campo de asunto: va en negrita al inicio, con el
      // nombre del docente porque el remitente visible es el bot de flujo.
      const mensajeHtml =
        canal === "teams"
          ? `<p><strong>${escaparHtml(asunto)}</strong><br><em>De: ${escaparHtml(docente)}</em></p>${cuerpo}`
          : cuerpo;

      tareas.push(async () => {
        try {
          await enviarPorFlujo(urlFlujo, { canal, correo, asunto, mensajeHtml });
          return { ...base, estado: "enviado", error: null };
        } catch (error) {
          return {
            ...base,
            estado: "fallido",
            error:
              error instanceof Error ? error.message : "Error desconocido.",
          };
        }
      });
    }
  }

  const resultados = await ejecutarConLimite(tareas, ENVIOS_SIMULTANEOS);

  if (resultados.length > 0) {
    const porId = new Map(
      ((practicantes ?? []) as Practicante[]).map((p) => [p.id, p])
    );
    const { error } = await supabase.from("comunicacion_envios").upsert(
      resultados.map((r) => ({
        comunicacion_id: comunicacionId,
        docente_id: user.id,
        practicante_id: r.practicanteId,
        nombre: r.nombre,
        correo: porId.get(r.practicanteId)?.correo_electronico ?? null,
        canal: r.canal,
        estado: r.estado,
        error: r.error,
        enviado_en: new Date().toISOString(),
      })),
      { onConflict: "comunicacion_id,practicante_id,canal" }
    );

    // Los mensajes ya salieron: el fallo del registro no debe ocultarlo.
    if (error) console.error("No se pudo registrar los envíos:", error.message);
  }

  return { resultados };
}

async function ejecutarConLimite<T>(
  tareas: (() => Promise<T>)[],
  limite: number
): Promise<T[]> {
  const resultados: T[] = new Array(tareas.length);
  let siguiente = 0;

  async function trabajador() {
    while (siguiente < tareas.length) {
      const indice = siguiente++;
      resultados[indice] = await tareas[indice]();
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limite, tareas.length) }, trabajador)
  );
  return resultados;
}
