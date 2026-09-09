import {
  MS_AUTHORITY,
  MS_CLIENT_ID,
  MS_CLIENT_SECRET,
  MS_GRAPH,
  MS_SCOPES,
} from "./config";

export type TokensMicrosoft = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

export type CarpetaGraph = {
  driveId: string;
  itemId: string;
  nombre: string;
  webUrl: string;
};

export type ArchivoGraph = {
  id: string;
  name: string;
  size: number;
  webUrl: string;
};

export class GraphError extends Error {}

// ---------------------------------------------------------------------------
// OAUTH
// ---------------------------------------------------------------------------

async function pedirTokens(
  cuerpo: Record<string, string>
): Promise<TokensMicrosoft> {
  const respuesta = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      scope: MS_SCOPES,
      ...cuerpo,
    }),
    cache: "no-store",
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new GraphError(
      datos?.error_description ?? "Microsoft rechazó la solicitud de token."
    );
  }

  return datos as TokensMicrosoft;
}

export function intercambiarCodigo(
  code: string,
  redirect_uri: string,
  code_verifier: string
) {
  return pedirTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri,
    code_verifier,
  });
}

export function refrescarTokens(refresh_token: string) {
  return pedirTokens({ grant_type: "refresh_token", refresh_token });
}

// ---------------------------------------------------------------------------
// LLAMADAS A GRAPH
// ---------------------------------------------------------------------------

function graph(
  accessToken: string,
  ruta: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(ruta.startsWith("http") ? ruta : `${MS_GRAPH}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function graphJson<T>(
  accessToken: string,
  ruta: string,
  init: RequestInit = {}
): Promise<T> {
  const respuesta = await graph(accessToken, ruta, init);
  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const mensaje =
      (datos as { error?: { message?: string } })?.error?.message ??
      `Error ${respuesta.status} al comunicarse con Microsoft 365.`;
    throw new GraphError(mensaje);
  }

  return datos as T;
}

/** Correo de la cuenta de Microsoft conectada. */
export async function correoDeLaCuenta(
  accessToken: string
): Promise<string | null> {
  const yo = await graphJson<{ mail?: string; userPrincipalName?: string }>(
    accessToken,
    "/me?$select=mail,userPrincipalName"
  );
  return yo.mail ?? yo.userPrincipalName ?? null;
}

/**
 * Codificación que exige Graph para resolver un enlace de "Compartir"
 * (incluidos los que traen ?d=...&csf=1&web=1) en /shares/{id}/driveItem.
 */
export function codificarUrlCompartida(url: string): string {
  const base64 = Buffer.from(url.trim(), "utf8").toString("base64");
  return `u!${base64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-")}`;
}

export async function resolverCarpeta(
  accessToken: string,
  urlCarpeta: string
): Promise<CarpetaGraph> {
  const item = await graphJson<{
    id: string;
    name: string;
    webUrl: string;
    folder?: unknown;
    parentReference?: { driveId?: string };
  }>(
    accessToken,
    `/shares/${codificarUrlCompartida(
      urlCarpeta
    )}/driveItem?$select=id,name,webUrl,folder,parentReference`
  );

  if (!item.folder) {
    throw new GraphError(
      "El enlace apunta a un archivo, no a una carpeta. Copia el enlace de la carpeta."
    );
  }

  const driveId = item.parentReference?.driveId;
  if (!driveId) {
    throw new GraphError(
      "No se pudo identificar la biblioteca de documentos del enlace."
    );
  }

  return { driveId, itemId: item.id, nombre: item.name, webUrl: item.webUrl };
}

// ---------------------------------------------------------------------------
// CARPETAS Y ARCHIVOS
// ---------------------------------------------------------------------------

/** SharePoint prohíbe los caracteres \ / : * ? " < > | y los puntos finales. */
export function sanitizarNombre(nombre: string): string {
  return nombre
    .replace(/[\\/:*?"<>|#%]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .slice(0, 120)
    .trim();
}

/**
 * Devuelve el id de la subcarpeta del estudiante, creándola si no existe.
 * conflictBehavior "fail" evita duplicar la carpeta si dos subidas coinciden.
 */
export async function asegurarSubcarpeta(
  accessToken: string,
  driveId: string,
  carpetaPadreId: string,
  nombre: string
): Promise<string> {
  const limpio = sanitizarNombre(nombre);
  if (!limpio) {
    throw new GraphError(
      "El nombre del estudiante no sirve como nombre de carpeta."
    );
  }

  const ruta = `/drives/${driveId}/items/${carpetaPadreId}:/${encodeURIComponent(
    limpio
  )}`;
  const existente = await graph(accessToken, `${ruta}?$select=id,folder`);

  if (existente.ok) {
    const datos = (await existente.json()) as { id: string; folder?: unknown };
    if (datos.folder) return datos.id;
    throw new GraphError(
      `Ya existe un archivo (no una carpeta) llamado "${limpio}" en el destino.`
    );
  }

  if (existente.status !== 404) {
    const datos = await existente.json().catch(() => null);
    throw new GraphError(
      (datos as { error?: { message?: string } })?.error?.message ??
        "No se pudo consultar la carpeta del estudiante."
    );
  }

  const creada = await graphJson<{ id: string }>(
    accessToken,
    `/drives/${driveId}/items/${carpetaPadreId}/children`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: limpio,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    }
  );

  return creada.id;
}

// Graph exige trozos múltiplos de 320 KiB. 5 MiB = 320 KiB x 16.
const TAMANO_TROZO = 5 * 1024 * 1024;
const LIMITE_SUBIDA_SIMPLE = 4 * 1024 * 1024;

export async function subirArchivo(
  accessToken: string,
  driveId: string,
  carpetaId: string,
  nombreArchivo: string,
  contenido: ArrayBuffer,
  tipoMime: string
): Promise<ArchivoGraph> {
  const nombre = sanitizarNombre(nombreArchivo) || "soporte";
  const destino = `/drives/${driveId}/items/${carpetaId}:/${encodeURIComponent(
    nombre
  )}`;

  // Archivos pequeños: una sola petición.
  if (contenido.byteLength <= LIMITE_SUBIDA_SIMPLE) {
    return graphJson<ArchivoGraph>(
      accessToken,
      `${destino}:/content?@microsoft.graph.conflictBehavior=rename`,
      {
        method: "PUT",
        headers: { "Content-Type": tipoMime || "application/octet-stream" },
        body: contenido,
      }
    );
  }

  // Archivos grandes: sesión de carga por trozos.
  const sesion = await graphJson<{ uploadUrl: string }>(
    accessToken,
    `${destino}:/createUploadSession`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item: { "@microsoft.graph.conflictBehavior": "rename", name: nombre },
      }),
    }
  );

  const total = contenido.byteLength;

  for (let inicio = 0; inicio < total; inicio += TAMANO_TROZO) {
    const fin = Math.min(inicio + TAMANO_TROZO, total);
    const respuesta = await fetch(sesion.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(fin - inicio),
        "Content-Range": `bytes ${inicio}-${fin - 1}/${total}`,
      },
      body: contenido.slice(inicio, fin),
    });

    // 200/201 = último trozo aceptado y archivo creado.
    if (respuesta.status === 200 || respuesta.status === 201) {
      return (await respuesta.json()) as ArchivoGraph;
    }

    if (!respuesta.ok) {
      await fetch(sesion.uploadUrl, { method: "DELETE" }).catch(() => {});
      throw new GraphError(
        `La subida falló en el bloque ${inicio}-${fin} (HTTP ${respuesta.status}).`
      );
    }
  }

  throw new GraphError(
    "La subida terminó sin que SharePoint confirmara el archivo."
  );
}

export async function eliminarArchivo(
  accessToken: string,
  driveId: string,
  itemId: string
): Promise<void> {
  const respuesta = await graph(
    accessToken,
    `/drives/${driveId}/items/${itemId}`,
    { method: "DELETE" }
  );

  // 404 = ya no está en SharePoint; se considera eliminado.
  if (!respuesta.ok && respuesta.status !== 404) {
    throw new GraphError("No se pudo eliminar el archivo en SharePoint.");
  }
}
