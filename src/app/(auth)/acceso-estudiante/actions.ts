"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deja lista la cuenta del estudiante antes de que el navegador pida el código.
 * No devuelve nada a propósito: la respuesta no debe delatar qué correos están
 * registrados en la matriz.
 *
 * La cuenta se crea ya confirmada porque Supabase les manda a las cuentas nuevas
 * sin confirmar el correo de "Confirm signup", que lleva un enlace, en vez del de
 * "Magic Link", que es el que lleva el código. Crearla no da acceso a nadie: para
 * entrar hay que tener el código que llega a ese buzón.
 */
export async function prepararAcceso(correo: string): Promise<void> {
  const email = correo.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  try {
    const admin = createAdminClient();

    const { data, error: errorMatriz } = await admin
      .from("practicantes")
      .select("id")
      .eq("correo_normalizado", email)
      .limit(1);

    if (errorMatriz) {
      console.error("No se pudo consultar la matriz:", errorMatriz.message);
      return;
    }

    if (!data?.length) return;

    // El token le demuestra a handle_new_user que esta cuenta la crea el portal,
    // y por eso le corresponde el rol de estudiante (ver schema.sql, sección 3a).
    const token = randomUUID();
    const { error: errorToken } = await admin
      .from("accesos_estudiante")
      .insert({ token, correo: email });

    if (errorToken) {
      console.error("No se pudo preparar la cuenta del estudiante:", errorToken.message);
      return;
    }

    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { acceso_estudiante: token },
    });

    await admin.from("accesos_estudiante").delete().eq("token", token);

    if (error && error.code !== "email_exists") {
      console.error("No se pudo preparar la cuenta del estudiante:", error.message);
    }
  } catch (error) {
    console.error("No se pudo preparar la cuenta del estudiante:", error);
  }
}
