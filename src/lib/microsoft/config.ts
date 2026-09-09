/**
 * Configuración del registro de aplicación de Azure AD (Entra ID).
 * Ver README/AGENTS.md para los pasos de creación de la app.
 */

export const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
export const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";

// El tenant de UCompensar. "organizations" permite cualquier cuenta
// corporativa; se recomienda fijar el GUID del tenant de la universidad.
export const MS_TENANT_ID = process.env.MICROSOFT_TENANT_ID ?? "organizations";

/**
 * Permisos DELEGADOS: la app actúa en nombre del docente y solo alcanza lo que
 * él mismo puede ver en OneDrive/SharePoint.
 * - offline_access: obtener refresh token para no pedir login cada vez.
 * - Files.ReadWrite.All: escribir en su OneDrive y en carpetas compartidas.
 * - User.Read: leer su correo para mostrar qué cuenta quedó conectada.
 */
export const MS_SCOPES = "offline_access Files.ReadWrite.All User.Read";

export const MS_AUTHORITY = `https://login.microsoftonline.com/${MS_TENANT_ID}`;
export const MS_GRAPH = "https://graph.microsoft.com/v1.0";

export function microsoftConfigurado(): boolean {
  return Boolean(MS_CLIENT_ID && MS_CLIENT_SECRET);
}

/** URL de retorno registrada en Azure AD. */
export function redirectUri(origen: string): string {
  return `${origen}/api/microsoft/callback`;
}
