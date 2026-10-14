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
- El navegador envía por lotes de 5 (`enviarLote`, máx. 10, 4 en paralelo, `maxDuration = 60`) para mostrar avance y no exceder el tiempo de Vercel. Es idempotente: lo ya "enviado" no se repite, y así funciona "Reintentar fallidos".
- Teams solo se intenta para correos `@ucompensar.edu.co`; los demás quedan "omitido" en Teams. Registro en `comunicaciones` + `comunicacion_envios` (único por comunicación, practicante y canal) e historial en la misma página.

## Base de datos (Supabase)

- `supabase/schema.sql` es idempotente; los cambios de esquema se aplican volviendo a ejecutarlo completo en el SQL Editor (incluye ALTER `add column if not exists practica`).
- `.env.local` (NO versionado) requiere: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_SERVICE_ROLE_KEY` (secret, solo script setup-admin).

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
