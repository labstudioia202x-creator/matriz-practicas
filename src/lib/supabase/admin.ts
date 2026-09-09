import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con service_role. SOLO puede importarse desde código de servidor
 * (server actions y route handlers): la clave nunca debe llegar al navegador.
 *
 * Se usa exclusivamente para la tabla `microsoft_conexiones`, que guarda los
 * refresh tokens y por eso no expone privilegios a anon/authenticated.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno. " +
        "Es necesaria para guardar la conexión con Microsoft."
    );
  }

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
