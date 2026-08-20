import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-primary-dark via-primary to-sky-400 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">
            Matriz de Seguimiento de Prácticas
          </h1>
          <p className="mt-1 text-sm text-sky-100">
            Ingeniería de Software · UCompensar
          </p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-sky-100/90">
          Acceso restringido a correos{" "}
          <Link
            href="https://www.ucompensar.edu.co"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            @ucompensar.edu.co
          </Link>
        </p>
      </div>
    </div>
  );
}