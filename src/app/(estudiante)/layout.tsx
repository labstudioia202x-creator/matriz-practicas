import type { Metadata } from "next";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "Mi práctica · UCompensar",
};

export default function EstudianteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-sm font-bold text-slate-900">Mi práctica</span>
          <LogoutButton destino="/acceso-estudiante" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Prácticas · Ingeniería de Software · UCompensar
      </footer>
    </div>
  );
}
