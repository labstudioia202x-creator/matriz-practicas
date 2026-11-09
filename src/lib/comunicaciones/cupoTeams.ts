// Microsoft limita las operaciones del bot de flujo de Teams a 25 por conexión
// cada 300 s (tabla "Throttling Limits" en
// https://learn.microsoft.com/connectors/teams/). Al pasarse, la acción
// "Publicar mensaje en un chat o canal" responde 429 "Rate limit is exceeded"
// y el flujo falla. La aplicación se queda uno por debajo, por si acaso.
export const CUPO_TEAMS = 24;
export const VENTANA_TEAMS_SEGUNDOS = 300;

// Cada intento se registra cuando el flujo responde, un poco después de la
// llamada a Teams; el margen cubre esa diferencia.
const MARGEN_SEGUNDOS = 10;
export const VENTANA_TEAMS_MS = (VENTANA_TEAMS_SEGUNDOS + MARGEN_SEGUNDOS) * 1000;

/**
 * Reparte el cupo de Teams del docente. `recientes` son los instantes (ms) de
 * sus intentos de Teams; `pedidos`, cuántos mensajes de Teams quiere mandar
 * ahora. Devuelve cuántos caben y, si no caben todos, en cuántos segundos se
 * libera el siguiente cupo.
 */
export function repartirCupoTeams(
  recientes: number[],
  pedidos: number,
  ahora: number
): { permitidos: number; esperarSegundos: number | null } {
  const vigentes = recientes
    .filter((t) => t > ahora - VENTANA_TEAMS_MS)
    .sort((a, b) => a - b);
  const permitidos = Math.min(
    pedidos,
    Math.max(0, CUPO_TEAMS - vigentes.length)
  );
  if (permitidos === pedidos) return { permitidos, esperarSegundos: null };

  // Contando los que salen ahora, el siguiente cupo se libera cuando vence el
  // intento que deja la cuenta justo en el tope.
  const ocupados = [...vigentes, ...new Array<number>(permitidos).fill(ahora)];
  const vence = ocupados[ocupados.length - CUPO_TEAMS] + VENTANA_TEAMS_MS;
  return {
    permitidos,
    esperarSegundos: Math.max(1, Math.ceil((vence - ahora) / 1000)),
  };
}

/** Minutos que tardan, como mínimo, `mensajes` de Teams con el cupo libre. */
export function minutosParaTeams(mensajes: number): number {
  const tandas = Math.ceil(mensajes / CUPO_TEAMS);
  return Math.max(0, tandas - 1) * (VENTANA_TEAMS_SEGUNDOS / 60);
}
