import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Practicante } from "@/lib/types";
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

  const { data: practicantes } = await supabase
    .from("practicantes")
    .select("*")
    .eq("docente_id", user.id)
    .order("created_at", { ascending: true });

  const totalReprobados =
    practicantes?.filter((p) => p.estado === "Reprobado").length ?? 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Mis practicantes
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {practicantes?.length ?? 0} registrados · {totalReprobados}{" "}
            reprobados
          </p>
        </div>
        <Link
          href="/practicantes/nuevo"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          + Nuevo practicante
        </Link>
      </div>

      {practicantes && practicantes.length > 0 ? (
        <div className="mt-6">
          <ListaPracticantes practicantes={practicantes as Practicante[]} />
        </div>
      ) : (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-4xl">📋</p>
          <h2 className="mt-3 text-lg font-semibold text-slate-800">
            Aún no has registrado practicantes
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Diligencia el primer practicante de tu grupo en la matriz de
            seguimiento.
          </p>
          <Link
            href="/practicantes/nuevo"
            className="mt-5 inline-block rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Registrar primer practicante
          </Link>
        </div>
      )}
    </div>
  );
}