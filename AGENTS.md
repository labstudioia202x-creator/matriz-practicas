<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Matriz de Seguimiento de Prácticas – UCompensar (contexto del proyecto)

Aplicación web (Next.js 16 App Router + TypeScript + Tailwind v4 + Supabase) para que docentes de Ingeniería de Software diligencien la matriz de seguimiento de practicantes (equivalente al Excel `Matriz de seguimiento práctica ingeniería de software.xlsx` fuera del repo). Desplegada en Vercel desde el repo de GitHub `labstudioia202x-creator/matriz-practicas` (origin configurado; push a `main` = deploy automático).

## Funcionalidades implementadas (hasta ago 2026, período 2026 - 2)

- Auth con Supabase: solo correos `@ucompensar.edu.co`, confirmación por correo; roles `docente` / `admin` (admin: `admin@ucompensar.edu.co`).
- CRUD de practicantes por docente (RLS: cada docente ve solo lo suyo; admin ve todo y exporta Excel con el formato de la matriz vía `/api/export`).
- Etiqueta `practica` por practicante: `Prácticas I | Prácticas II | Prácticas III` (columnas/badges en listas, filtro, export).
- Cargue masivo desde Excel: plantilla descargable `/api/plantilla` + página `/practicantes/cargar` + acción `cargarPracticantes` (valida filas, evita duplicados por N° documento, reporta errores por fila).
- "Mis practicantes": buscador + filtros por Práctica y Estado (componente `ListaPracticantes`).
- Dashboard con conteos por práctica y estado; layout a ancho completo (sin `max-w-6xl`).
- Ordenamiento por columna en "Mis practicantes": clic en el encabezado alterna ascendente / descendente / sin orden; los campos vacíos quedan siempre al final.
- Soportes por practicante subidos a SharePoint/OneDrive (`/practicantes/[id]/soportes`), con carpeta parametrizable por docente (`/configuracion`).
- Comunicaciones masivas personalizadas por Teams y correo (`/comunicaciones`), ver sección propia.
- Portal del estudiante (`/acceso-estudiante` → `/mi-practica`): entra con un código al correo, completa datos, sube documentos e indica su paso. Ver sección propia.

## Soportes en SharePoint / OneDrive

- Cada docente conecta **su propia** cuenta de Microsoft (OAuth delegado, PKCE) desde `/configuracion` y pega el enlace de la carpeta donde quiere los soportes. La app resuelve el enlace con Graph (`/shares/{u!base64}/driveItem`) y cachea `driveId` + `itemId` en `profiles`.
- Al subir un soporte se crea (si no existe) una subcarpeta con el `nombre_completo` del estudiante dentro de esa carpeta, y ahí se guarda el archivo. Registro en la tabla `soportes`.
- Los refresh tokens viven en `microsoft_conexiones`, tabla **sin privilegios** para `anon`/`authenticated`: solo el servidor la toca con la service_role key (`src/lib/supabase/admin.ts`). Microsoft rota el refresh token en cada uso y el código lo regraba.
- Requiere un registro de app en Azure AD (Entra ID) con permisos **delegados** `offline_access`, `Files.ReadWrite.All`, `User.Read`, y las URI de redireccionamiento de local y de producción. Variables: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID` (ver `.env.local.example`).
- Límite de 20 MB por archivo (`TAMANO_MAXIMO_SOPORTE_MB`) y `serverActions.bodySizeLimit: "25mb"` en `next.config.ts`. **Ojo en Vercel**: el cuerpo de una petición a una función serverless tiene un tope de ~4.5 MB, así que en producción los archivos más grandes fallarán aunque el límite de la app sea mayor; para superarlo habría que subir desde el navegador directo a la sesión de carga de Graph.
- ROPC (usuario y contraseña) no es una opción: está deprecado y se bloquea con MFA.

### Estado real (sep 2026)

- El docente **no tiene acceso a Entra ID** en el tenant de UCompensar, así que la vía de OAuth con Microsoft **no se puede usar todavía**. Su sección se quitó de `/configuracion`, pero **el código sigue en el repo** (`src/lib/microsoft/*`, `src/app/api/microsoft/*`, `FormularioCarpeta`, `BotonDesconectar`) y la lógica de subida aún lo soporta: basta con volver a mostrar la sección cuando TI registre la app.
- La vía activa es un **flujo de Power Automate** por docente (`flujos_soportes`): disparador HTTP con "Cualquiera" (URL con firma `sig=`, es una credencial) → OneDrive "Crear archivo". La app manda `{carpeta, nombreArchivo, contenidoBase64}`; el flujo crea la subcarpeta del estudiante si no existe. Probado end to end.
- Limitaciones de esa vía: el `webUrl` vuelve vacío (la acción *Crear archivo* de OneDrive no lo devuelve, haría falta *Crear vínculo para compartir*), y **no se puede borrar** el archivo remoto, por lo que eliminar un soporte solo quita el registro y avisa al docente.
- Ojo con los nombres de carpeta: OneDrive rechaza los que terminan en espacio.

## Comunicaciones masivas (Teams + correo)

- `/comunicaciones`: el docente filtra/marca estudiantes, elige canales (Teams, correo), escribe asunto y mensaje con variables (`{nombre}`, `{practica}`, `{empresa}`, `{estado}`, `{programa}`, `{tutor}`, `{fecha_inicio}`, `{fecha_fin}`, `{docente}`; definidas en `src/lib/comunicaciones/plantilla.ts`) y ve la vista previa por estudiante.
- Mismo patrón que los soportes: **segundo flujo de Power Automate por docente** (`flujos_comunicaciones`, solo servidor; bandera `profiles.flujo_comunicaciones_configurado`). La app hace UNA llamada por estudiante y canal con `{canal, correo, asunto, mensajeHtml}`; el flujo usa una Condición: `teams` → "Publicar mensaje en un chat o canal" como Bot de flujo en el chat con el bot; si no → Outlook "Enviar un correo (V2)". La acción Respuesta 200 al final es obligatoria para saber si salió (502 = falló una acción).
- El navegador envía por lotes de 2 estudiantes (`enviarPorLotes` → `enviarLote`, 4 llamadas en paralelo, 30 s de tope por llamada, `maxDuration = 60`). Cada resultado se guarda apenas termina. Es idempotente: lo ya "enviado" no se repite.
- `comunicaciones.destinatarios` guarda los elegidos; el historial muestra "N sin enviar" y los botones "Enviar a los que faltan" / "Reintentar fallidos".
- Incidente oct 2026: con lotes de 5 y registro al final del lote, el envío se cortó a los 25 de 46 (función cortada por tiempo, probablemente por los reintentos de Teams dentro del flujo) y Teams falló en todos. Recomendado: en el flujo, directiva de reintentos "Ninguna" en la acción de Teams.
- Imágenes adjuntas (hasta 3, máximo 3 MB en total, JPG/PNG/GIF/WEBP; `validarImagenes` en `src/lib/comunicaciones/imagenes.ts`): se suben una vez al crear la comunicación y se guardan en base64 en `comunicacion_adjuntos` (solo servidor), así los reintentos las vuelven a mandar. Solo van en el correo, como `adjuntos: [{Name, ContentBytes}]`, que el flujo pasa tal cual a *Datos adjuntos* de Outlook (`coalesce(triggerBody()?['adjuntos'], json('[]'))`). El chat de Teams del bot de flujo no admite adjuntos: allí va un aviso. Un flujo sin ese paso manda el correo sin imágenes y responde 200 igual, así que la app no lo detecta.
- Teams solo se intenta para correos `@ucompensar.edu.co`; los demás quedan "omitido" en Teams. Registro en `comunicaciones` + `comunicacion_envios` (único por comunicación, practicante y canal) e historial en la misma página.

## Portal del estudiante

- Acceso sin contraseña: `/acceso-estudiante` llama a `prepararAcceso` (si el correo está en `practicantes`, crea la cuenta ya confirmada) y luego el navegador usa `signInWithOtp` + `verifyOtp` de Supabase Auth. Se llama desde el navegador para que los límites por IP apliquen a cada estudiante.
- El correo lo envía Supabase, **no** el flujo de Power Automate del docente: si pasara por el flujo, el docente vería el código y podría entrar como el estudiante, o como el admin poniendo su correo en un practicante. No cambiar esto sin resolver ese problema.
- Requiere configurar Supabase: SMTP propio, plantilla **Magic Link** con `{{ .Token }}` y límite de correos por hora (ver README). La cuenta se crea confirmada porque las cuentas nuevas sin confirmar reciben la plantilla "Confirm signup", que lleva enlace y no código.
- Rol `estudiante`: lo asigna `handle_new_user` solo a cuentas creadas por `prepararAcceso` con un token de un solo uso de `accesos_estudiante` (tabla solo de servidor) y cuyo correo está en la matriz. No se puede distinguir por la contraseña: Supabase genera una aleatoria en `admin.createUser`, y `app_metadata` y la confirmación se escriben después del insert, así que el trigger no los ve. Unión por `practicantes.correo_normalizado` (columna generada). Un mismo correo puede tener varias prácticas (selector `?p=`).
- Autorización: el estudiante **no tiene RLS** sobre `practicantes`, porque RLS no limita columnas y podría aprobarse a sí mismo. Todo pasa por `src/lib/portal/sesion.ts` con service_role, filtrando por el correo verificado y con lista cerrada de columnas (nunca `estado`, `motivo_reprobacion`, `observaciones`). `src/proxy.ts` lo saca de las rutas de docente, incluidas sus server actions.
- Datos: solo puede llenar campos vacíos (`CAMPOS_ESTUDIANTE`); lo ya diligenciado lo corrige el docente.
- `practicantes.avance` (`Inicio | En curso | Finalizado`) lo reporta el estudiante. Es distinto de `estado`, el resultado oficial del docente. `Inicio` y `En curso` no bloquean por pendientes; `Finalizado` exige toda la tercera entrega, validado en el servidor (`marcarAvance`).
- La guía sigue las tres entregas oficiales y se edita en `src/lib/portal/guia.ts`. Hay dos tipos de requisito: `documento` (archivo; algunos solo PDF) y `formulario` (se diligencia fuera de la app: check en `practicantes.formularios_diligenciados` y evidencia en `soportes`, opcional en las entregas 1 y 2, obligatoria en la 3). Los `id` quedan guardados: no renombrarlos si ya hay entregas cargadas.
- Las entregas oficiales recibidas cubren Contrato laboral, Contrato de aprendizaje, Convenio y Social o comunitaria. Emprendimiento y Consultoría no son competencia del docente que define esta guía: no hay requisitos propios previstos y, si un practicante tiene una de esas modalidades, ve la misma guía. Confirmado por el docente: la evidencia del formulario de la tercera entrega es obligatoria y `Finalizado` no exige las entregas 1 y 2. Los formularios aún no existen, así que la guía no tiene enlaces: el estudiante solo declara con el check que lo diligenció.
- Los documentos van a la carpeta del docente con el mismo flujo de soportes (`src/lib/soportes/subir.ts`); si el docente no lo tiene configurado, el estudiante no puede subir y `/practicantes` lo avisa. Tope de 4 MB por el límite de Vercel, solo PDF, imágenes y Office.
- El docente y el admin ven avance y completitud en `ListaPracticantes`, `TablaAdmin`, el dashboard y la página de soportes. El Excel exportado no cambió.

## Base de datos (Supabase)

- `supabase/schema.sql` es idempotente; los cambios de esquema se aplican volviendo a ejecutarlo completo en el SQL Editor (incluye ALTER `add column if not exists practica`).
- `.env.local` (NO versionado) requiere: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (secret: setup-admin, flujos y portal del estudiante; también en Vercel).
- Los roles nunca salen de los metadatos del usuario ni los puede cambiar él mismo: la sesión solo puede actualizar las columnas de `profiles` listadas en la sección 10 de `schema.sql`. Si la app empieza a escribir otra columna de `profiles` con la sesión del usuario, hay que agregarla ahí.

## Enlaces del sitio

- Producción: `https://matriz-practicas-8o1ytvw9h-matriz-practicas.vercel.app` (login, `/practicantes`, `/practicantes/cargar`, `/admin`).
- Desarrollo local: `npm run dev` (usar puerto alternativo si está ocupado).

## Comandos de verificación (correr SIEMPRE antes de subir cambios)

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## Flujo de subida de cambios

1. `git add -A` → `git commit -m "..."` (mensaje en español, estilo de los commits previos) → `git push origin main`.
2. Vercel redespliega automáticamente; avisar al usuario que espere el deploy.

## Utilidades fuera del repo (no versionadas)

- `Cargue_Ejemplo_UCompensar.xlsx` en la carpeta superior: archivo de prueba con 8 estudiantes ficticios para probar el cargue masivo (subirlo 2 veces debe ignorar duplicados).
- Recordatorio: si el usuario menciona una captura/imagen, este modelo no admite imágenes; pedirle que describa el problema.
