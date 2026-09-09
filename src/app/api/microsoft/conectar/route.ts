import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  MS_AUTHORITY,
  MS_CLIENT_ID,
  MS_SCOPES,
  microsoftConfigurado,
  redirectUri,
} from "@/lib/microsoft/config";

export const dynamic = "force-dynamic";

function base64url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/**
 * Inicia el flujo OAuth delegado: manda al docente a iniciar sesión en
 * Microsoft para que autorice el acceso a SU propio OneDrive/SharePoint.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }

  if (!microsoftConfigurado()) {
    return NextResponse.redirect(
      new URL("/configuracion?error=sin_configurar", request.nextUrl.origin)
    );
  }

  // PKCE + state para proteger el intercambio del código.
  const codeVerifier = base64url(randomBytes(48));
  const codeChallenge = base64url(
    createHash("sha256").update(codeVerifier).digest()
  );
  const state = base64url(randomBytes(24));

  const autorizacion = new URL(`${MS_AUTHORITY}/oauth2/v2.0/authorize`);
  autorizacion.searchParams.set("client_id", MS_CLIENT_ID);
  autorizacion.searchParams.set("response_type", "code");
  autorizacion.searchParams.set(
    "redirect_uri",
    redirectUri(request.nextUrl.origin)
  );
  autorizacion.searchParams.set("response_mode", "query");
  autorizacion.searchParams.set("scope", MS_SCOPES);
  autorizacion.searchParams.set("state", state);
  autorizacion.searchParams.set("code_challenge", codeChallenge);
  autorizacion.searchParams.set("code_challenge_method", "S256");
  // Fuerza la pantalla de consentimiento la primera vez.
  autorizacion.searchParams.set("prompt", "select_account");

  const respuesta = NextResponse.redirect(autorizacion);

  const opciones = {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };

  respuesta.cookies.set("ms_state", state, opciones);
  respuesta.cookies.set("ms_verifier", codeVerifier, opciones);

  return respuesta;
}
