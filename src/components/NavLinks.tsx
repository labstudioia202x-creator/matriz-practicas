"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function NavLinks({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Inicio" },
    { href: "/practicantes", label: "Mis practicantes" },
    { href: "/configuracion", label: "Configuración" },
    ...(esAdmin ? [{ href: "/admin", label: "Administración" }] : []),
  ];

  return (
    <>
      {links.map((link) => {
        const activo =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              activo
                ? "bg-primary text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}