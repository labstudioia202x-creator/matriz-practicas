import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import NavLinks from "@/components/NavLinks";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  const esAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </span>
            <span className="hidden text-sm font-bold text-slate-900 sm:block">
              Matriz de Prácticas
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <NavLinks esAdmin={esAdmin} />
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-slate-900">
                {profile?.full_name || user.email}
              </p>
              <p className="text-xs text-slate-500">
                {profile?.email} ·{" "}
                {esAdmin ? "Administrador" : "Docente"}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Matriz de seguimiento de prácticas · Ingeniería de Software ·
        UCompensar · Período 2026 - 2
      </footer>
    </div>
  );
}