import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Zona de docentes y administradores: el estudiante no entra aquí. El proxy
// también cubre las server actions, porque se invocan con POST a estas rutas.
const PAGINAS_PERSONAL = [
  "/dashboard",
  "/practicantes",
  "/comunicaciones",
  "/configuracion",
  "/admin",
];
const API_PERSONAL = ["/api/export", "/api/plantilla", "/api/microsoft"];
const PAGINAS_ACCESO = ["/login", "/registro", "/acceso-estudiante"];

const coincide = (path: string, rutas: string[]) =>
  rutas.some((ruta) => path === ruta || path.startsWith(`${ruta}/`));

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Una redirección debe conservar la sesión que se acaba de refrescar.
  const redirigir = (pathname: string) => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const respuesta = NextResponse.redirect(url);
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => respuesta.cookies.set(cookie));
    return respuesta;
  };

  const path = request.nextUrl.pathname;
  const esPaginaPersonal = coincide(path, PAGINAS_PERSONAL);
  const esZonaPersonal = esPaginaPersonal || coincide(path, API_PERSONAL);
  const esAcceso = coincide(path, PAGINAS_ACCESO);

  if (!user) {
    if (coincide(path, ["/mi-practica"])) return redirigir("/acceso-estudiante");
    if (esPaginaPersonal) return redirigir("/login");
    return supabaseResponse;
  }

  if (esZonaPersonal || esAcceso) {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const esEstudiante = perfil?.role === "estudiante";

    if (esZonaPersonal && esEstudiante) return redirigir("/mi-practica");
    if (esAcceso) return redirigir(esEstudiante ? "/mi-practica" : "/dashboard");
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
