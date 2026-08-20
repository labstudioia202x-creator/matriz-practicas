import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticanteConDocente } from "@/lib/types";
import { ESTADOS } from "@/lib/constants";
import TablaAdmin from "@/components/TablaAdmin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/practicantes");
  }

  const { data: practicantes, error } = await supabase
    .from("practicantes")
    .select("*, docente:profiles!docente_id(full_name, email)")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const docentes = new Map<string, string>();
  practicantes?.forEach((p) => {
    const nombre = p.docente?.full_name || p.docente?.email || "";
    if (!docentes.has(p.docente_id)) {
      docentes.set(p.docente_id, nombre);
    }
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administración</h1>
          <p className="mt-1 text-sm text-slate-500">
            Todos los practicantes registrados por los docentes (
            {practicantes?.length ?? 0} en total · {docentes.size} docentes).
          </p>
        </div>
        <a
          href="/api/export"
          className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800"
        >
          ⬇ Exportar a Excel
        </a>
      </div>

      <div className="mt-6">
        <TablaAdmin
          practicantes={practicantes as PracticanteConDocente[]}
          estados={ESTADOS as readonly string[]}
        />
      </div>
    </div>
  );
}