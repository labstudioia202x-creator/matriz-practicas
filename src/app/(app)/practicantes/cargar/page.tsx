import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CargueMasivo from "@/components/CargueMasivo";

export const dynamic = "force-dynamic";

export default async function CargarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Cargue masivo de practicantes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sube todos tus estudiantes asignados de una vez desde un archivo
          Excel. Solo aplica a tu propio grupo.
        </p>
      </div>

      <CargueMasivo />
    </div>
  );
}