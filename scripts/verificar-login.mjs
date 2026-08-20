import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function cargarEnv() {
  const archivo = path.join(process.cwd(), ".env.local");
  if (!existsSync(archivo)) return {};
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...cargarEnv(), ...process.env };

// Mismo flujo que la página de login de la app (publishable key)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email: "admin@ucompensar.edu.co",
  password: "Admin.Practicas2026",
});

if (error) {
  console.error("ERROR login:", error.message);
  process.exit(1);
}

console.log("✔ Login admin OK. Usuario:", data.user.email);
console.log("  Perfil (metadata): full_name =", data.user.user_metadata.full_name, "| role =", data.user.user_metadata.role);

// Verifica que el perfil se lee con la sesión del admin (RLS: policy admin)
const { data: perfiles, error: errPerfiles } = await supabase
  .from("profiles")
  .select("email, role");

if (errPerfiles) {
  console.error("ERROR leyendo perfiles con sesión admin:", errPerfiles.message);
  process.exit(1);
}

console.log("✔ Sesión de admin puede ver todos los perfiles (RLS OK):", perfiles.map((p) => p.email).join(", "));