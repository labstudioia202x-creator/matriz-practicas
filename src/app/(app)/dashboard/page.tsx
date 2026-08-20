import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ESTADOS, PRACTICAS } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const esAdmin = profile?.role === "admin";

  const query = supabase
    .from("practicantes")
    .select("estado, practica")
    .order("created_at");
  if (!esAdmin) {
    query.eq("docente_id", user.id);
  }

  const { data: practicantes } = await query;

  const total = practicantes?.length ?? 0;
  const porEstado = ESTADOS.map((estado) => ({
    estado,
    cantidad: practicantes?.filter((p) => p.estado === estado).length ?? 0,
  }));

  const colores: Record<string, string> = {
    Aprobado: "bg-green-100 text-green-800 border-green-200",
    Vinculado: "bg-blue-100 text-blue-800 border-blue-200",
    "No Iniciado": "bg-slate-100 text-slate-700 border-slate-200",
    Reprobado: "bg-red-100 text-red-700 border-red-200",
    Ausente: "bg-amber-100 text-amber-800 border-amber-200",
    "No vinculado": "bg-slate-200 text-slate-800 border-slate-300",
  };

  const porPractica = PRACTICAS.map((practica) => ({
    practica,
    cantidad: practicantes?.filter((p) => p.practica === practica).length ?? 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Hola, {profile?.full_name?.split(" ")[0] || ""}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {esAdmin
          ? "Vista general de todos los practicantes registrados."
          : "Resumen de los practicantes que tienes asignados."}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total de practicantes</p>
          <p className="mt-1 text-3xl font-bold text-primary">{total}</p>
        </div>

        {porPractica.map(({ practica, cantidad }) => (
          <div
            key={practica}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <span className="inline-block rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-800">
              {practica}
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {cantidad}
            </p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-slate-500">
        Por estado
      </h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        {porEstado.map(({ estado, cantidad }) => (
          <div
            key={estado}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                colores[estado] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {estado}
            </span>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {cantidad}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/practicantes"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          Ver / diligenciar practicantes
        </Link>
        <Link
          href="/practicantes/cargar"
          className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          ⬆ Cargar desde Excel
        </Link>
        <Link
          href="/practicantes/nuevo"
          className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          + Registrar practicante
        </Link>
        {esAdmin && (
          <a
            href="/api/export"
            className="rounded-lg border border-green-600 px-4 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
          >
            ⬇ Exportar Excel
          </a>
        )}
      </div>
    </div>
  );
}