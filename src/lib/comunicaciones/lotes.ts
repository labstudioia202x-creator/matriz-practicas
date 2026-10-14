import { enviarLote, ResultadoEnvio } from "@/app/(app)/comunicaciones/actions";

// Debe coincidir con TAMANO_MAXIMO_LOTE de la acción.
const TAMANO_LOTE = 2;

/**
 * Envía la comunicación a `ids` lote por lote desde el navegador. Llama a
 * `alAvanzar` tras cada lote; devuelve el mensaje de error si se detuvo.
 */
export async function enviarPorLotes(
  comunicacionId: string,
  ids: string[],
  alAvanzar: (nuevos: ResultadoEnvio[], procesados: number) => void
): Promise<string | null> {
  let procesados = 0;

  for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
    const lote = ids.slice(i, i + TAMANO_LOTE);

    let respuesta: Awaited<ReturnType<typeof enviarLote>>;
    try {
      respuesta = await enviarLote(comunicacionId, lote);
    } catch {
      return `El envío se interrumpió después de ${procesados} de ${ids.length} estudiantes. Lo enviado quedó registrado: usa "Enviar a los que faltan" en el historial.`;
    }

    if (respuesta.error) return respuesta.error;

    procesados += lote.length;
    alAvanzar(respuesta.resultados ?? [], procesados);
  }

  return null;
}
