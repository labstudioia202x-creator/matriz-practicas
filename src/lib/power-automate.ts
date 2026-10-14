/**
 * Valida la URL del disparador HTTP de un flujo de Power Automate. Debe traer
 * la firma `sig=`: sin ella el flujo exige un token de Entra ID que la
 * aplicación no puede obtener. Devuelve el mensaje de error o null si sirve.
 */
export function validarUrlDisparador(url: string): string | null {
  if (!url) {
    return "Pega la URL HTTP POST del disparador de tu flujo.";
  }

  let direccion: URL;
  try {
    direccion = new URL(url);
  } catch {
    return "Eso no es una dirección web válida.";
  }

  if (direccion.protocol !== "https:") {
    return "La URL del disparador debe empezar por https://";
  }

  if (!/\/triggers\/[^/]+\/paths\/invoke/i.test(direccion.pathname)) {
    return "Esa no parece la URL del disparador. Debe contener /triggers/manual/paths/invoke.";
  }

  if (!direccion.searchParams.get("sig")) {
    return 'A la URL le falta la firma (sig=). En el disparador, cambia "¿Quién puede desencadenar el flujo?" a "Cualquiera", guarda y copia la URL de nuevo.';
  }

  return null;
}
