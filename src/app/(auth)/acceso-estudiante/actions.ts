"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deja lista la cuenta del estudiante antes de que el navegador pida el código.
 * No devuelve nada a propósito: la respuesta no debe delatar qué correos están
 * registrados en la matriz.
 *
 * La cuenta se crea ya confirmada y sin contraseña porque Supabase les manda a
 * las cuentas nuevas sin confirmar el correo de "Confirm signup", que lleva un
 * enlace, en vez del de "Magic Link", que es el que lleva el código. Crearla no da
 * acceso a nadie: para entrar hay que tener el código que llega a ese buzón.
 */
export async function prepararAcceso(correo: string): Promise<void> {
  const email = correo.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("practicantes")
      .select("id")
      .eq("correo_normalizado", email)
      .limit(1);

    if (!data?.length) return;

    const { error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (error && error.code !== "email_exists") {
      console.error("No se pudo preparar la cuenta del estudiante:", error.message);
    }
  } catch (error) {
    console.error("No se pudo preparar la cuenta del estudiante:", error);
  }
}
