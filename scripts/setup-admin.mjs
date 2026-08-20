// ----------------------------------------------------------------------------
// Crea el usuario administrador de la app usando la API admin oficial de
// Supabase (reemplaza al antiguo supabase_admin.create_user, que ya no existe
// en proyectos nuevos).
//
// Uso:
//   1. Copia .env.local.example -> .env.local y agrega SUPABASE_SERVICE_ROLE_KEY
//      (Supabase: Project Settings > API > service_role).
//   2. Ejecuta:  npm run setup-admin
//
// La service_role key es SECRETA: nunca debe usarse en el navegador, solo en
// scripts de servidor como este.
// ----------------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const EMAIL_ADMIN = "admin@ucompensar.edu.co";
const PASSWORD_DEFAULT = "Admin.Practicas2026";

function cargarEnvLocal() {
  const archivo = path.join(process.cwd(), ".env.local");
  if (!existsSync(archivo)) return {};
  const env = {};
  for (const linea of readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...cargarEnvLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const password = env.ADMIN_PASSWORD || PASSWORD_DEFAULT;

if (!url || !serviceKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  console.error("Mira las instrucciones en el README.md, sección 5.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const { data, error } = await supabase.auth.admin.createUser({
    email: EMAIL_ADMIN,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Administrador de Prácticas",
      role: "admin",
    },
  });

  if (error) {
    if (/already registered|user_already_exists/i.test(error.message)) {
      console.log("El admin ya existe en auth.users.");
      console.log(
        "Si su perfil no tiene rol 'admin', ejecuta en el SQL Editor:"
      );
      console.log(
        "  update public.profiles set role = 'admin' where email = 'admin@ucompensar.edu.co';"
      );
      process.exit(0);
    }
    console.error("Error al crear el administrador:", error.message);
    process.exit(1);
  }

  console.log(`✔ Usuario administrador creado: ${data.user.email}`);
  console.log(`  Contraseña inicial: ${password}`);
  console.log(
    "  Cámbiala después del primer ingreso (Dashboard > Authentication > Users)."
  );
} catch (e) {
  console.error("Error inesperado:", e.message);
  process.exit(1);
}