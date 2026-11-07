"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  AdjuntoCorreo,
  enviarPorFlujo,
  obtenerUrlFlujoComunicaciones,
} from "@/lib/comunicaciones/flujo";
import { validarImagenes } from "@/lib/comunicaciones/imagenes";
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
// avance y no chocar con el tiempo máximo de la función en Vercel (60 s):
// 2 estudiantes x 2 canales = 4 llamadas en paralelo, cada una con tope de
// 30 s (ver `enviarPorFlujo`), así que un lote cabe holgado en una sola ola.
const TAMANO_MAXIMO_LOTE = 2;
const ENVIOS_SIMULTANEOS = 4;

/**
 * Registra la comunicación con sus imágenes y devuelve su id; el envío va en
 * `enviarLote`. Las imágenes llegan en un FormData (campo "imagenes").
 */
export async function crearComunicacion(
  datos: {
    asunto: string;
    mensaje: string;
    canales: Canal[];
    practicanteIds: string[];
  },
  archivos?: FormData
): Promise<{ id?: string; error?: string }> {
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
  const destinatarios = [...new Set(datos.practicanteIds)];
  if (destinatarios.length < 1) {
    return { error: "Selecciona al menos un estudiante." };
  }

  const imagenes = (archivos?.getAll("imagenes") ?? []).filter(
    (a): a is File => a instanceof File
  );
  const errorImagenes = validarImagenes(imagenes);
  if (errorImagenes) return { error: errorImagenes };
  if (imagenes.length > 0 && !canales.includes("correo")) {
    return {
      error:
        "Las imágenes solo se envían por correo: activa el canal de correo o quítalas.",
    };
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
      destinatarios,
      total_destinatarios: destinatarios.length,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  if (imagenes.length > 0) {
    const admin = createAdminClient();
    const { error: errorAdjuntos } = await admin
      .from("comunicacion_adjuntos")
      .insert(
        await Promise.all(
          imagenes.map(async (imagen) => ({
            comunicacion_id: data.id,
            nombre: imagen.name,
            tipo_mime: imagen.type,
            tamano_bytes: imagen.size,
            contenido_base64: Buffer.from(await imagen.arrayBuffer()).toString(
              "base64"
            ),
          }))
        )
      );

    if (errorAdjuntos) {
      // Sin sus imágenes no se envía: se borra para que no quede en el
      // historial como una comunicación pendiente.
      await admin.from("comunicaciones").delete().eq("id", data.id);
      return { error: `No se pudieron guardar las imágenes: ${errorAdjuntos.message}` };
    }
  }

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

  const [
    { data: perfil },
    { data: practicantes },
    { data: previos },
    { data: imagenes, error: errorImagenes },
  ] = await Promise.all([
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
      // La comunicación ya se comprobó arriba como del docente de la sesión.
      createAdminClient()
        .from("comunicacion_adjuntos")
        .select("nombre, contenido_base64")
        .eq("comunicacion_id", comunicacionId)
        .order("creado_en", { ascending: true }),
    ]);

  // Sin las imágenes es mejor no enviar que mandar el correo incompleto.
  if (errorImagenes) {
    return { error: `No se pudieron leer las imágenes: ${errorImagenes.message}` };
  }

  const adjuntos: AdjuntoCorreo[] = (imagenes ?? []).map((i) => ({
    Name: i.nombre,
    ContentBytes: i.contenido_base64,
  }));
  const notaTeams =
    adjuntos.length > 0 && (comunicacion.canales as Canal[]).includes("correo")
      ? `<p><em>Te envié ${adjuntos.length === 1 ? "una imagen adjunta" : `${adjuntos.length} imágenes adjuntas`} por correo.</em></p>`
      : "";

  const docente = perfil?.full_name || perfil?.email || "";
  const yaEnviados = new Set(
    (previos ?? []).map((e) => `${e.practicante_id}:${e.canal}`)
  );

  const tareas: (() => Promise<ResultadoEnvio>)[] = [];
  const correos = new Map<string, string | null>();

  for (const p of (practicantes ?? []) as Practicante[]) {
    const nombre = p.nombre_completo || "(sin nombre)";
    const correo = p.correo_electronico?.trim() ?? "";
    correos.set(p.id, p.correo_electronico);
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
      // Teams no admite adjuntos desde el bot de flujo: allí va solo un aviso.
      const mensajeHtml =
        canal === "teams"
          ? `<p><strong>${escaparHtml(asunto)}</strong><br><em>De: ${escaparHtml(docente)}</em></p>${cuerpo}${notaTeams}`
          : cuerpo;
      const envio =
        canal === "correo"
          ? { canal, correo, asunto, mensajeHtml, adjuntos }
          : { canal, correo, asunto, mensajeHtml };

      tareas.push(async () => {
        try {
          await enviarPorFlujo(urlFlujo, envio);
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

  // Cada resultado se registra apenas termina: si la función se corta por
  // tiempo, lo que ya salió queda guardado y "Enviar a los que faltan" no lo
  // repite.
  const registrar = async (r: ResultadoEnvio) => {
    const { error } = await supabase.from("comunicacion_envios").upsert(
      {
        comunicacion_id: comunicacionId,
        docente_id: user.id,
        practicante_id: r.practicanteId,
        nombre: r.nombre,
        correo: correos.get(r.practicanteId) ?? null,
        canal: r.canal,
        estado: r.estado,
        error: r.error,
        enviado_en: new Date().toISOString(),
      },
      { onConflict: "comunicacion_id,practicante_id,canal" }
    );
    // El mensaje ya salió (o no): el fallo del registro no debe ocultarlo.
    if (error) console.error("No se pudo registrar el envío:", error.message);
    return r;
  };

  const resultados = await ejecutarConLimite(
    tareas.map((tarea) => async () => registrar(await tarea())),
    ENVIOS_SIMULTANEOS
  );

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
