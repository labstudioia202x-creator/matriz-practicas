import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticanteConDocumentos } from "@/lib/types";
import ListaPracticantes from "@/components/ListaPracticantes";

export const dynamic = "force-dynamic";

export default async function PracticantesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: practicantes }, { data: perfil }, cabeceras] = await Promise.all([
    supabase
      .from("practicantes")
      .select("*, soportes(tipo_documento)")
      .eq("docente_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("flujo_configurado, sharepoint_item_id")
      .eq("id", user.id)
      .maybeSingle(),
    headers(),
  ]);

  const destinoListo = Boolean(
    perfil?.flujo_configurado || perfil?.sharepoint_item_id
  );
  const protocolo = cabeceras.get("x-forwarded-proto") ?? "https";
  const enlacePortal = `${protocolo}://${cabeceras.get("host")}/acceso-estudiante`;

  // Los registros de prueba no cuentan en los totales.
  const reales = (practicantes ?? []).filter((p) => !p.prueba);
  const totalReprobados = reales.filter((p) => p.estado === "Reprobado").length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Mis practicantes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {reales.length} registrados · {totalReprobados}{" "}
            reprobados
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/practicantes/cargar"
            className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            ⬆ Cargar desde Excel
          </Link>
          <Link
            href="/practicantes/nuevo"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            + Nuevo practicante
          </Link>
        </div>
      </div>

      {practicantes && practicantes.length > 0 && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            <span className="font-semibold text-slate-900">
              Espacio de tus estudiantes:
            </span>{" "}
            entran en{" "}
            <span className="break-all font-medium text-primary">
              {enlacePortal}
            </span>{" "}
            con el correo que registraste aquí y reciben un código de acceso.
          </p>
          {!destinoListo && (
            <p className="mt-2 text-amber-800">
              Aún no podrán subir documentos:{" "}
              <Link
                href="/configuracion"
                className="font-semibold underline underline-offset-2"
              >
                configura el flujo de soportes
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {practicantes && practicantes.length > 0 ? (
        <div className="mt-6">
          <ListaPracticantes
            practicantes={practicantes as PracticanteConDocumentos[]}
          />
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-4xl">📋</p>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">
            Aún no has registrado practicantes
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Diligencia el primer practicante de tu grupo en la matriz de
            seguimiento, o cárgalos todos desde un archivo Excel.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/practicantes/cargar"
              className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
            >
              ⬆ Cargar desde Excel
            </Link>
            <Link
              href="/practicantes/nuevo"
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              Registrar primer practicante
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}