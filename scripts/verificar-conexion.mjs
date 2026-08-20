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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: perfiles, error: errPerfiles } = await supabase
  .from("profiles")
  .select("email, full_name, role")
  .order("email");

if (errPerfiles) {
  console.error("ERROR consultando profiles:", errPerfiles.message);
  console.log("=> Si dice 'relation does not exist', ejecuta primero el schema.sql completo en el SQL Editor.");
  process.exit(1);
}

console.log("✔ Tabla profiles OK. Perfiles:", JSON.stringify(perfiles));

const { data: count, error: errCount } = await supabase
  .from("practicantes")
  .select("id", { count: "exact", head: true });

if (errCount) {
  console.error("ERROR consultando practicantes:", errCount.message);
  process.exit(1);
}

console.log(`✔ Tabla practicantes OK (${count} filas). Conexion y base configurada.`);