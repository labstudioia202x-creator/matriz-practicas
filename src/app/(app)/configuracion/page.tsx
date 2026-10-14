import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FormularioFlujo from "@/components/FormularioFlujo";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("flujo_configurado, flujo_comunicaciones_configurado")
    .eq("id", user.id)
    .maybeSingle();

  const flujoConfigurado = Boolean(perfil?.flujo_configurado);
  const comunicacionesConfiguradas = Boolean(
    perfil?.flujo_comunicaciones_configurado
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
      <p className="mt-1 text-sm text-slate-500">
        Conecta tus flujos de Power Automate: uno guarda los soportes de cada
        practicante y otro envía las comunicaciones por Teams y correo.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Estado del destino */}
      <div
        className={`mt-6 rounded-xl border p-4 text-sm ${
          flujoConfigurado
            ? "border-green-300 bg-green-50 text-green-900"
            : "border-amber-300 bg-amber-50 text-amber-900"
        }`}
      >
        {flujoConfigurado
          ? "Los soportes se guardan en tu OneDrive a través de tu flujo de Power Automate."
          : "Todavía no puedes subir soportes: configura abajo tu flujo de Power Automate."}
      </div>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              Flujo de Power Automate
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Creas un flujo en tu propia cuenta que recibe el archivo y lo
              guarda en la carpeta de OneDrive que tú definas. Dentro de ella la
              aplicación crea una subcarpeta por estudiante con sus nombres y
              apellidos completos.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              flujoConfigurado
                ? "bg-green-100 text-green-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {flujoConfigurado ? "Configurado" : "Sin configurar"}
          </span>
        </div>

        <FormularioFlujo configurado={flujoConfigurado} />

        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            ¿Cómo creo el flujo?
          </summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate-500">
            <li>
              En make.powerautomate.com crea un <b>flujo de nube instantáneo</b>{" "}
              con el disparador <b>Cuando se recibe una solicitud HTTP</b>.
            </li>
            <li>
              Pega este esquema JSON en el disparador:
              <code className="mt-1 block overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                {`{"type":"object","properties":{"carpeta":{"type":"string"},"nombreArchivo":{"type":"string"},"contenidoBase64":{"type":"string"}}}`}
              </code>
            </li>
            <li>
              Agrega <b>OneDrive para la Empresa → Crear archivo</b>. En{" "}
              <i>Ruta de carpeta</i> pon tu carpeta, una barra <code>/</code> y
              la ficha <code>carpeta</code>, sin espacios al final. En{" "}
              <i>Nombre de archivo</i>, la ficha <code>nombreArchivo</code>. En{" "}
              <i>Contenido</i>, la expresión:
              <code className="mt-1 block overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                base64ToBinary(triggerBody()?[&#39;contenidoBase64&#39;])
              </code>
            </li>
            <li>
              Opcional: agrega la acción <b>Respuesta</b> con código 200 para que
              la lista muestre el enlace al archivo.
            </li>
            <li>
              En el disparador, pon <b>¿Quién puede desencadenar el flujo?</b> en{" "}
              <b>Cualquiera</b>, guarda y copia la URL HTTP POST.
            </li>
          </ol>
        </details>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">
              Flujo de comunicaciones (Teams y correo)
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Un segundo flujo en tu cuenta que recibe cada mensaje ya
              personalizado y lo publica en el chat de Teams del estudiante o
              lo envía por correo desde tu Outlook.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              comunicacionesConfiguradas
                ? "bg-green-100 text-green-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {comunicacionesConfiguradas ? "Configurado" : "Sin configurar"}
          </span>
        </div>

        <FormularioFlujo
          configurado={comunicacionesConfiguradas}
          tipo="comunicaciones"
        />

        <details className="mt-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">
            ¿Cómo creo el flujo?
          </summary>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-slate-500">
            <li>
              En make.powerautomate.com crea un <b>flujo de nube instantáneo</b>{" "}
              con el disparador <b>Cuando se recibe una solicitud HTTP</b> y
              pega este esquema JSON:
              <code className="mt-1 block overflow-x-auto rounded bg-slate-50 p-2 text-xs">
                {`{"type":"object","properties":{"canal":{"type":"string"},"correo":{"type":"string"},"asunto":{"type":"string"},"mensajeHtml":{"type":"string"}}}`}
              </code>
            </li>
            <li>
              Agrega una <b>Condición</b>: <code>canal</code> es igual a{" "}
              <code>teams</code>.
            </li>
            <li>
              En <b>Verdadero</b>: <b>Microsoft Teams → Publicar mensaje en un
              chat o canal</b>. <i>Publicar como</i>: <b>Bot de flujo</b>;{" "}
              <i>Publicar en</i>: <b>Chat con el bot de flujo</b>;{" "}
              <i>Destinatario</i>: la ficha <code>correo</code>;{" "}
              <i>Mensaje</i>: la ficha <code>mensajeHtml</code>.
            </li>
            <li>
              En <b>Falso</b>: <b>Office 365 Outlook → Enviar un correo
              electrónico (V2)</b>. <i>Para</i>: <code>correo</code>;{" "}
              <i>Asunto</i>: <code>asunto</code>; <i>Cuerpo</i>:{" "}
              <code>mensajeHtml</code>. El correo sale desde tu buzón.
            </li>
            <li>
              Después de la condición agrega la acción <b>Respuesta</b> con
              código <b>200</b>. Es obligatoria: así la aplicación sabe si cada
              mensaje salió o falló.
            </li>
            <li>
              En el disparador, pon <b>¿Quién puede desencadenar el flujo?</b> en{" "}
              <b>Cualquiera</b>, guarda y copia la URL HTTP POST.
            </li>
          </ol>
          <p className="mt-2 text-xs text-slate-400">
            En Teams el remitente visible es el bot de flujo (Workflows); por
            eso el mensaje incluye el asunto y tu nombre al inicio. Solo llega a
            correos @ucompensar.edu.co; a los demás se les envía solo el
            correo.
          </p>
        </details>
      </section>
    </div>
  );
}
