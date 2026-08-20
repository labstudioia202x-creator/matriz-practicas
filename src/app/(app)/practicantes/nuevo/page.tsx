import Link from "next/link";
import PracticanteForm from "@/components/PracticanteForm";

export default function NuevoPracticantePage() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Nuevo practicante
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Diligencia la información del estudiante.
          </p>
        </div>
        <Link
          href="/practicantes"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Volver
        </Link>
      </div>

      <PracticanteForm />
    </div>
  );
}