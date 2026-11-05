"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { prepararAcceso } from "./actions";

const inputClases =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

export default function AccesoEstudiantePage() {
  const router = useRouter();

  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // El código se pide y se verifica desde el navegador para que los límites por
  // IP de Supabase se apliquen a cada estudiante y no al servidor compartido.
  async function enviarCodigo() {
    const email = correo.trim().toLowerCase();
    setError(null);
    setAviso(null);
    setCargando(true);

    await prepararAcceso(email);

    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });

    setCargando(false);

    // otp_disabled = el correo no tiene cuenta. Se responde igual que si la
    // tuviera, para no revelar quién está registrado en la matriz.
    if (error && error.code !== "otp_disabled") {
      setError(
        error.code === "over_email_send_rate_limit" || error.status === 429
          ? "Ya pediste un código hace poco. Espera un minuto y vuelve a intentarlo."
          : "No pudimos enviar el código. Intenta de nuevo en unos minutos; si sigue fallando, avísale a tu docente."
      );
      return false;
    }

    setPaso("codigo");
    return true;
  }

  async function verificarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);

    const { error } = await createClient().auth.verifyOtp({
      email: correo.trim().toLowerCase(),
      token: codigo,
      type: "email",
    });

    if (error) {
      setError(
        error.status === 429
          ? "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
          : "El código no es correcto o ya venció. Revísalo o pide uno nuevo."
      );
      setCargando(false);
      return;
    }

    router.replace("/mi-practica");
    router.refresh();
  }

  if (paso === "codigo") {
    return (
      <div>
        <h2 className="text-lg font-semibold text-slate-800">
          Escribe tu código
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Si <span className="font-medium text-slate-700">{correo.trim().toLowerCase()}</span>{" "}
          está registrado en la matriz, te llegará un código en unos minutos.
          Revisa también el correo no deseado.
        </p>

        <form onSubmit={verificarCodigo} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="codigo"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Código de acceso
            </label>
            <input
              id="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              minLength={6}
              maxLength={10}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className={`${inputClases} text-center text-lg tracking-[0.4em]`}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {aviso && (
            <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800">
              {aviso}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando || codigo.length < 6}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Verificando…" : "Entrar a mi espacio"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap justify-between gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              setPaso("correo");
              setCodigo("");
              setError(null);
              setAviso(null);
            }}
            className="font-medium text-slate-500 hover:text-slate-900"
          >
            ← Cambiar correo
          </button>
          <button
            type="button"
            disabled={cargando}
            onClick={async () => {
              setCodigo("");
              if (await enviarCodigo()) {
                setAviso("Si tu correo está registrado, te enviamos un código nuevo.");
              }
            }}
            className="font-semibold text-primary hover:underline disabled:opacity-50"
          >
            Enviar otro código
          </button>
        </div>

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">
          ¿No te llega? Debes usar el mismo correo con el que te registró tu
          docente. Si no estás seguro de cuál es, pregúntale.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800">
        Espacio del estudiante
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Entra sin contraseña: te enviamos un código de acceso al correo con el
        que te registró tu docente.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enviarCodigo();
        }}
        className="mt-6 space-y-4"
      >
        <div>
          <label
            htmlFor="correo"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Correo electrónico
          </label>
          <input
            id="correo"
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            className={inputClases}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={cargando}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cargando ? "Enviando…" : "Enviarme el código"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        ¿Eres docente?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Inicia sesión aquí
        </Link>
      </p>
    </div>
  );
}
