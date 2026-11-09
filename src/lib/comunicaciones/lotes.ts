import { enviarLote, ResultadoEnvio } from "@/app/(app)/comunicaciones/actions";

// Debe coincidir con TAMANO_MAXIMO_LOTE de la acción.
const TAMANO_LOTE = 2;

/** Pausa por el límite de Teams: hasta cuándo (ms) y de cuántos segundos. */
export type PausaTeams = { hasta: number; segundos: number };

/**
 * Envía la comunicación a `ids` lote por lote desde el navegador. Llama a
 * `alAvanzar` tras cada lote; devuelve el mensaje de error si se detuvo.
 *
 * Si el servidor aplaza estudiantes porque se acabó el cupo de Teams (ver
 * cupoTeams.ts), vuelven al frente de la cola y se espera lo que indique,
 * avisando con `alPausar`.
 */
export async function enviarPorLotes(
  comunicacionId: string,
  ids: string[],
  alAvanzar: (nuevos: ResultadoEnvio[], procesados: number) => void,
  alPausar?: (pausa: PausaTeams | null) => void
): Promise<string | null> {
  const cola = [...ids];
  let procesados = 0;

  while (cola.length > 0) {
    const lote = cola.slice(0, TAMANO_LOTE);

    let respuesta: Awaited<ReturnType<typeof enviarLote>>;
    try {
      respuesta = await enviarLote(comunicacionId, lote);
    } catch (error) {
      // Queda en la consola del navegador (F12) para diagnosticar el corte.
      console.error("Falló el lote de comunicaciones:", error);
      return `El envío se interrumpió después de ${procesados} de ${ids.length} estudiantes. Lo enviado quedó registrado: usa "Enviar a los que faltan" en el historial.`;
    }

    if (respuesta.error) return respuesta.error;

    const aplazados = lote.filter((id) => respuesta.aplazados?.includes(id));
    cola.splice(0, lote.length, ...aplazados);
    procesados += lote.length - aplazados.length;
    alAvanzar(respuesta.resultados ?? [], procesados);

    if (aplazados.length > 0) {
      await pausar(Math.max(1, respuesta.esperarSegundos ?? 30), alPausar);
    }
  }

  return null;
}

/**
 * Espera con UN solo temporizador. En una pestaña en segundo plano el
 * navegador retrasa los temporizadores encadenados (hasta uno por minuto), así
 * que una cuenta regresiva de un segundo por paso alargaría la pausa a horas;
 * la cuenta que se ve en pantalla es aparte y solo informa.
 */
function pausar(segundos: number, alPausar?: (pausa: PausaTeams | null) => void) {
  alPausar?.({ hasta: Date.now() + segundos * 1000, segundos });
  return new Promise<void>((listo) =>
    setTimeout(() => {
      alPausar?.(null);
      listo();
    }, segundos * 1000)
  );
}
