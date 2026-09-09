import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectUri } from "@/lib/microsoft/config";
import { correoDeLaCuenta, intercambiarCodigo } from "@/lib/microsoft/graph";
import { guardarConexion } from "@/lib/microsoft/conexion";

export const dynamic = "force-dynamic";

function volver(origen: string, parametros: Record<string, string>) {
  const url = new URL("/configuracion", origen);
  Object.entries(parametros).forEach(([clave, valor]) =>
    url.searchParams.set(clave, valor)
  );
  const respuesta = NextResponse.redirect(url);
  respuesta.cookies.delete("ms_state");
  respuesta.cookies.delete("ms_verifier");
  return respuesta;
}

/** Retorno de Microsoft tras el consentimiento del docente. */
export async function GET(request: NextRequest) {
  const origen = request.nextUrl.origin;
  const parametros = request.nextUrl.searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", origen));
  }

  const errorMs = parametros.get("error_description") ?? parametros.get("error");
  if (errorMs) {
    return volver(origen, { error: errorMs.slice(0, 300) });
  }

  const code = parametros.get("code");
  const state = parametros.get("state");
  const stateGuardado = request.cookies.get("ms_state")?.value;
  const verifier = request.cookies.get("ms_verifier")?.value;

  if (!code || !state || !verifier || state !== stateGuardado) {
    return volver(origen, {
      error: "La autorización no se pudo validar. Inténtalo de nuevo.",
    });
  }

  try {
    const tokens = await intercambiarCodigo(
      code,
      redirectUri(origen),
      verifier
    );
    const correo = await correoDeLaCuenta(tokens.access_token);
    await guardarConexion(user.id, tokens, correo);
  } catch (error) {
    return volver(origen, {
      error:
        error instanceof Error
          ? error.message.slice(0, 300)
          : "No se pudo conectar la cuenta de Microsoft.",
    });
  }

  return volver(origen, { conectado: "1" });
}
