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

// Cliente ANÓNIMO (publishable key) — mismo rol que usa la app en el navegador
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase.from("practicantes").select("id").limit(1);

if (error) {
  console.error("ERROR con publishable key:", error.message);
  if (/permission denied|does not exist/i.test(error.message)) {
    console.log(
      "=> Ejecuta NUEVAMENTE el schema.sql COMPLETO (la versión actual incluye los GRANTs explícitos)."
    );
  }
  process.exit(1);
}

console.log("✔ Publishable key OK: la app podrá consultar sin sesión (RLS devolverá 0 filas anónimas).");

const { error: errJwt } = await supabase.from("profiles").select("id").limit(1);
if (errJwt) {
  console.error("ERROR profiles anónimo:", errJwt.message);
  if (/permission denied|does not exist/i.test(errJwt.message)) {
    console.log(
      "=> Ejecuta NUEVAMENTE el schema.sql COMPLETO (la versión actual incluye los GRANTs explícitos)."
    );
  }
  process.exit(1);
}
console.log("✔ profiles OK con publishable key.");