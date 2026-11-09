"use client";

import { useEffect, useState } from "react";
import { PausaTeams } from "@/lib/comunicaciones/lotes";

/**
 * Aviso de la pausa por el límite de Teams, con su cuenta regresiva. La cuenta
 * solo informa: el envío sigue cuando vence el temporizador de
 * `enviarPorLotes`. Usar con `key={pausa.hasta}` para que cada pausa empiece
 * su propia cuenta.
 */
export default function AvisoPausaTeams({ pausa }: { pausa: PausaTeams }) {
  const [restante, setRestante] = useState(pausa.segundos);

  useEffect(() => {
    const id = setInterval(
      () =>
        setRestante(Math.max(0, Math.ceil((pausa.hasta - Date.now()) / 1000))),
      1000
    );
    return () => clearInterval(id);
  }, [pausa.hasta]);

  return (
    <p
      role="status"
      className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs text-slate-700"
    >
      Pausa por el límite de Teams: Microsoft deja que el bot mande 25 mensajes
      cada 5 minutos. El envío sigue solo en{" "}
      <b>
        {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, "0")}
      </b>
      .
    </p>
  );
}
