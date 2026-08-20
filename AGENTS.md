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
