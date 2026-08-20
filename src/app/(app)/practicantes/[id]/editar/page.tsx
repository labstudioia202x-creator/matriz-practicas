import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PracticanteForm from "@/components/PracticanteForm";
import { Practicante } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditarPracticantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: practicante } = await supabase
    .from("practicantes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!practicante || practicante.docente_id !== user.id) {
    notFound();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Editar practicante
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Actualiza la información del estudiante.
          </p>
        </div>
        <Link
          href="/practicantes"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Volver
        </Link>
      </div>

      <PracticanteForm practicante={practicante as Practicante} />
    </div>
  );
}