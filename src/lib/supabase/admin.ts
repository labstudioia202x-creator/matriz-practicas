import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role. SOLO puede importarse desde código de servidor
 * (server actions y route handlers): la clave nunca debe llegar al navegador.
 *
 * Se usa para las tablas de credenciales (sin privilegios para anon/authenticated)
 * y para el portal del estudiante, que filtra siempre por el correo verificado de
 * la sesión (ver src/lib/portal/sesion.ts).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno del servidor. " +
        "Es necesaria para las credenciales de los flujos y el portal del estudiante. " +
        "En Vercel se agrega en Settings > Environment Variables."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
