"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Practicante } from "@/lib/types";
import { PRACTICAS, ESTADOS } from "@/lib/constants";
import {
  CANALES,
  Canal,
  ETIQUETA_CANAL,
  VARIABLES,
  admiteTeams,
  correoValido,
  personalizar,
  textoAHtml,
} from "@/lib/comunicaciones/plantilla";
import {
  crearComunicacion,
  ResultadoEnvio,
} from "@/app/(app)/comunicaciones/actions";
import { enviarPorLotes } from "@/lib/comunicaciones/lotes";

const coloresEstado: Record<ResultadoEnvio["estado"], string> = {
  enviado: "bg-green-100 text-green-800",
  fallido: "bg-red-100 text-red-700",
  omitido: "bg-amber-100 text-amber-800",
};

export default function EnvioComunicaciones({
  practicantes,
  docente,
  habilitado,
}: {
  practicantes: Practicante[];
  docente: string;
  habilitado: boolean;
}) {
  const router = useRouter();
  const mensajeRef = useRef<HTMLTextAreaElement>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroPractica, setFiltroPractica] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const [canales, setCanales] = useState<Set<Canal>>(new Set(CANALES));
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [idVistaPrevia, setIdVistaPrevia] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [resultados, setResultados] = useState<ResultadoEnvio[]>([]);
  const [comunicacionId, setComunicacionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return practicantes.filter((p) => {
      if (filtroPractica && p.practica !== filtroPractica) return false;
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (!texto) return true;
      return [p.nombre_completo, p.numero_documento, p.empresa, p.correo_electronico]
        .some((v) => v?.toLowerCase().includes(texto));
    });
  }, [practicantes, busqueda, filtroPractica, filtroEstado]);

  const seleccionados = practicantes.filter((p) => seleccion.has(p.id));
  const todosFiltradosMarcados =
    filtrados.length > 0 && filtrados.every((p) => seleccion.has(p.id));

  const sinCorreo = seleccionados.filter(
    (p) => !correoValido(p.correo_electronico)
  ).length;
  const sinTeams = canales.has("teams")
    ? seleccionados.filter(
        (p) =>
          correoValido(p.correo_electronico) && !admiteTeams(p.correo_electronico)
      ).length
    : 0;

  const vistaPrevia =
    practicantes.find((p) => p.id === idVistaPrevia) ??
    seleccionados[0] ??
    filtrados[0];

  function alternar(id: string) {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  function alternarFiltrados() {
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      for (const p of filtrados) {
        if (todosFiltradosMarcados) nueva.delete(p.id);
        else nueva.add(p.id);
      }
      return nueva;
    });
  }

  function alternarCanal(canal: Canal) {
    setCanales((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(canal)) nuevo.delete(canal);
      else nuevo.add(canal);
      return nuevo;
    });
  }

  // Inserta la variable donde está el cursor del mensaje
  function insertarVariable(clave: string) {
    const campo = mensajeRef.current;
    const ficha = `{${clave}}`;
    if (!campo) {
      setMensaje((m) => m + ficha);
      return;
    }
    const inicio = campo.selectionStart;
    const fin = campo.selectionEnd;
    setMensaje(mensaje.slice(0, inicio) + ficha + mensaje.slice(fin));
    requestAnimationFrame(() => {
      campo.focus();
      campo.setSelectionRange(inicio + ficha.length, inicio + ficha.length);
    });
  }

  // Envía por lotes y va acumulando resultados; reemplaza los de un reintento
  async function procesar(id: string, ids: string[]) {
    setProgreso({ hechos: 0, total: ids.length });

    const fallo = await enviarPorLotes(id, ids, (nuevos, procesados) => {
      setResultados((actuales) => [
        ...actuales.filter(
          (r) =>
            !nuevos.some(
              (n) => n.practicanteId === r.practicanteId && n.canal === r.canal
            )
        ),
        ...nuevos,
      ]);
      setProgreso({ hechos: procesados, total: ids.length });
    });

    if (fallo) setError(fallo);
  }

  async function enviar() {
    setError(null);

    if (
      !confirm(
        `Se enviará "${asunto.trim()}" a ${seleccionados.length} estudiante(s) por ${[
          ...canales,
        ]
          .map((c) => ETIQUETA_CANAL[c])
          .join(" y ")}. ¿Continuar?`
      )
    ) {
      return;
    }

    setEnviando(true);
    setResultados([]);
    try {
      const creada = await crearComunicacion({
        asunto,
        mensaje,
        canales: [...canales],
        practicanteIds: seleccionados.map((p) => p.id),
      });
      if (!creada.id) {
        setError(creada.error ?? "No se pudo crear la comunicación.");
        return;
      }
      setComunicacionId(creada.id);
      await procesar(
        creada.id,
        seleccionados.map((p) => p.id)
      );
      router.refresh();
    } catch {
      setError("Se interrumpió el envío. Revisa el historial y reintenta.");
    } finally {
      setEnviando(false);
    }
  }

  async function reintentarFallidos() {
    if (!comunicacionId) return;
    setError(null);
    setEnviando(true);
    try {
      const ids = [
        ...new Set(
          resultados
            .filter((r) => r.estado === "fallido")
            .map((r) => r.practicanteId)
        ),
      ];
      await procesar(comunicacionId, ids);
      router.refresh();
    } catch {
      setError("Se interrumpió el reintento.");
    } finally {
      setEnviando(false);
    }
  }

  const fallidos = resultados.filter((r) => r.estado === "fallido").length;
  const puedeEnviar =
    habilitado &&
    !enviando &&
    seleccionados.length > 0 &&
    canales.size > 0 &&
    asunto.trim() !== "" &&
    mensaje.trim() !== "";

  if (practicantes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        Aún no tienes practicantes registrados a quienes escribir.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Destinatarios */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">
          1. Destinatarios{" "}
          <span className="text-sm font-normal text-slate-500">
            ({seleccionados.length} seleccionados)
          </span>
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar…"
            className="min-w-[160px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
          <select
            value={filtroPractica}
            onChange={(e) => setFiltroPractica(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Todas las prácticas</option>
            {PRACTICAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>

        <label className="mt-3 flex items-center gap-2 border-b border-slate-200 pb-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={todosFiltradosMarcados}
            onChange={alternarFiltrados}
            className="h-4 w-4 accent-primary"
          />
          Marcar los {filtrados.length} que se muestran
        </label>

        <ul className="mt-1 max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
          {filtrados.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-start gap-2 py-2">
                <input
                  type="checkbox"
                  checked={seleccion.has(p.id)}
                  onChange={() => alternar(p.id)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="min-w-0">
                  <span className="block font-medium text-slate-800">
                    {p.nombre_completo || "(sin nombre)"}
                  </span>
                  <span
                    className={`block truncate text-xs ${
                      correoValido(p.correo_electronico)
                        ? "text-slate-500"
                        : "text-red-600"
                    }`}
                  >
                    {p.correo_electronico || "Sin correo"} ·{" "}
                    {p.practica || "—"} · {p.estado || "—"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {(sinCorreo > 0 || sinTeams > 0) && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            {sinCorreo > 0 && `${sinCorreo} sin correo válido (se omitirán). `}
            {sinTeams > 0 &&
              `${sinTeams} con correo no institucional: recibirán solo el correo, no Teams.`}
          </p>
        )}
      </section>

      {/* Mensaje */}
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold text-slate-900">2. Mensaje</h2>

        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {CANALES.map((canal) => (
            <label key={canal} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={canales.has(canal)}
                onChange={() => alternarCanal(canal)}
                className="h-4 w-4 accent-primary"
              />
              {canal === "teams" ? "Chat de Teams" : "Correo electrónico"}
            </label>
          ))}
        </div>

        <label
          htmlFor="asunto"
          className="mt-3 block text-sm font-medium text-slate-700"
        >
          Asunto
        </label>
        <input
          id="asunto"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          maxLength={200}
          placeholder="Seguimiento de {practica}"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />

        <label
          htmlFor="mensaje"
          className="mt-3 block text-sm font-medium text-slate-700"
        >
          Mensaje
        </label>
        <div className="mt-1 flex flex-wrap gap-1">
          {VARIABLES.map((v) => (
            <button
              key={v.clave}
              type="button"
              onClick={() => insertarVariable(v.clave)}
              title={v.descripcion}
              className="rounded-full border border-slate-300 px-2 py-0.5 font-mono text-xs text-slate-600 transition hover:border-primary hover:text-primary"
            >
              {`{${v.clave}}`}
            </button>
          ))}
        </div>
        <textarea
          id="mensaje"
          ref={mensajeRef}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          rows={8}
          placeholder={
            "Hola {nombre},\n\nTe recuerdo que debes entregar el informe de {practica} de tu práctica en {empresa}.\n\nSaludos,\n{docente}"
          }
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />

        {/* Vista previa */}
        {vistaPrevia && (asunto || mensaje) && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Vista previa
              </p>
              <select
                value={vistaPrevia.id}
                onChange={(e) => setIdVistaPrevia(e.target.value)}
                className="max-w-[60%] rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                {(seleccionados.length ? seleccionados : filtrados).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre_completo || "(sin nombre)"}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-2 font-semibold text-slate-900">
              {personalizar(asunto, vistaPrevia, docente)}
            </p>
            <div
              className="prose-sm mt-1 space-y-2 text-slate-700 [&_a]:text-primary [&_a]:underline"
              dangerouslySetInnerHTML={{
                __html: textoAHtml(personalizar(mensaje, vistaPrevia, docente)),
              }}
            />
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={!puedeEnviar}
          className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
        >
          {enviando
            ? `Enviando… ${progreso.hechos} de ${progreso.total}`
            : `Enviar a ${seleccionados.length} estudiante(s)`}
        </button>

        {enviando && progreso.total > 0 && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(progreso.hechos / progreso.total) * 100}%` }}
            />
          </div>
        )}
      </section>

      {/* Resultado del envío */}
      {resultados.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900">Resultado</h2>
            {fallidos > 0 && !enviando && (
              <button
                type="button"
                onClick={reintentarFallidos}
                className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
              >
                Reintentar {fallidos} fallido(s)
              </button>
            )}
          </div>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            {resultados.map((r) => (
              <li
                key={`${r.practicanteId}:${r.canal}`}
                className="flex flex-wrap items-center gap-2 py-1.5"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${coloresEstado[r.estado]}`}
                >
                  {r.estado}
                </span>
                <span className="font-medium text-slate-800">{r.nombre}</span>
                <span className="text-xs text-slate-500">
                  {ETIQUETA_CANAL[r.canal]}
                </span>
                {r.error && (
                  <span className="text-xs text-slate-500">— {r.error}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
