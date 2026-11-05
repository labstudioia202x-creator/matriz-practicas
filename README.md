# Matriz de Seguimiento de Prácticas – UCompensar

Aplicación web (responsive, funciona en computador y celular) para que los **docentes** de Ingeniería de Software diligencien la **matriz de seguimiento de practicantes** (la misma información del archivo `Matriz de seguimiento práctica ingeniería de software.xlsx`). Los datos se guardan en **Supabase** y el **administrador** puede verlos todos y exportarlos a Excel con el mismo formato de la matriz.

## Funcionalidades

- **Registro de docentes** únicamente con correos `@ucompensar.edu.co` (verificado tanto en la app como en la base de datos).
- **Confirmación por correo** al registrarse y login con correo + contraseña.
- **Cada docente** registra, edita y elimina únicamente **sus propios practicantes** (seguridad con Row Level Security de Supabase).
- **Cargue masivo desde Excel**: el docente descarga la **plantilla** desde el sitio, la diligencia y sube un archivo `.xlsx` para registrar a todos sus practicantes de una vez (con validación de filas, detección de duplicados por documento y reporte de errores por fila).
- **Etiqueta de práctica**: cada practicante se identifica con su práctica (**Prácticas I**, **Prácticas II** o **Prácticas III**).
- **Administrador** (cuenta `admin@ucompensar.edu.co`): ve **todos** los practicantes de todos los docentes, con buscador y filtro por estado, y **exporta a Excel** (`.xlsx`) con el mismo formato de la matriz: títulos, encabezados por sección, listas desplegables y fechas.
- Todos los campos conservan las **mismas listas de validación del Excel** (práctica, programa, semestre, modalidad, estado).
- **Espacio del estudiante**: cada estudiante registrado entra con un **código enviado a su correo**, completa los datos que faltan, sube sus documentos y sigue una guía con las tres entregas de la práctica (Inicio, En curso, Finalizado). El docente y el administrador ven en qué paso va y qué le falta.

## Tecnologías

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase**: Auth (correo/contraseña), Postgres con Row Level Security, validaciones a nivel de base de datos
- **exceljs** para generar el Excel de exportación

---

## 1. Requisitos

- Node.js 20 o superior
- Una cuenta gratuita en [supabase.com](https://supabase.com)

## 2. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**.
2. Nombre sugerido: `matriz-practicas-ucompensar`.
3. Guarda la **contraseña de la base de datos** en un lugar seguro.
4. Región: la más cercana (por ejemplo `South America (São Paulo)`).
5. Espera a que se cree el proyecto (~2 minutos).

## 3. Ejecutar el script de base de datos

1. En el dashboard de Supabase ve a **SQL Editor** → **New query**.
2. Copia **todo** el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pégalo.
3. Ejecuta (botón **Run**). Esto crea:
   - La tabla `profiles` (docente/admin) con restricción de correo `@ucompensar.edu.co`.
   - La tabla `practicantes` con los mismos campos y listas del Excel.
   - Triggers (perfil automático al registrarse, fechas de actualización).
   - Políticas de Row Level Security (cada docente ve solo lo suyo; el admin ve todo).

> ⚠️ Nota: si tu script falló con `schema "supabase_admin" does not exist`, es porque
> ejecutaste una versión anterior. Vuelve a copiar **todo** el contenido actual de
> `supabase/schema.sql` y ejecútalo de nuevo (el script es idempotente y reemplaza
> el bloque obsoleto de creación del admin).

> ⚠️ Actualización (cargue masivo + práctica): si ya ejecutaste una versión anterior
> del script, la nueva ejecución agrega automáticamente la columna `practica`
> (Prácticas I, II o III) con un comando `alter table ... add column if not exists`.

## 4. Configurar la autenticación

1. En Supabase: **Authentication** → **URL Configuration**:
   - **Site URL**: `http://localhost:3000` (desarrollo). Al desplegar, pon la URL de producción.
   - **Redirect URLs**: agrega `http://localhost:3000/auth/confirm` y, al desplegar, `https://TU-DOMINIO/auth/confirm`.
2. Opcional pero recomendado: en **Providers → Email**, confirma:
   - **Confirm email**: activado (por defecto lo está).
   - Puedes personalizar la plantilla del correo de confirmación en *Email templates → Confirm signup*.

### Código de acceso de los estudiantes

Los estudiantes entran con un código que envía Supabase. Requiere tres ajustes en el dashboard:

1. **Authentication → Emails → SMTP Settings**: configura un SMTP propio. El servicio de correo incluido en Supabase solo envía a los miembros del equipo del proyecto y con un límite muy bajo, así que no le llegaría a los estudiantes.
2. **Authentication → Emails → Templates → Magic Link**: la plantilla debe mostrar el código, no un enlace:

   ```html
   <h2>Tu código de acceso</h2>
   <p>Escribe este código en el espacio del estudiante de la Matriz de Prácticas:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Es personal: no lo compartas. Si no lo pediste, ignora este correo.</p>
   ```

   Asunto sugerido: `Tu código de acceso a la Matriz de Prácticas`. Esta plantilla no la usan los docentes, que siguen entrando con contraseña.
3. **Authentication → Rate Limits**: sube el límite de correos por hora según el tamaño de tus grupos. Con SMTP propio arranca en 30 por hora y todo un grupo podría entrar el mismo día.

Mantén **Confirm email** activado: el acceso del estudiante se basa en que el correo de la sesión esté verificado.

## 5. Variables de entorno

1. En Supabase: **Project Settings → API**.
2. Copia la **Project URL**, la **Publishable key** (antigua `anon`) y la **Secret key** (antigua `service_role`; esta última es secreta y solo se usa en el servidor).
3. Crea el archivo `.env.local` en la raíz del proyecto (puedes copiar desde `.env.local.example`):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...   # publishable key
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...            # secret key (solo en el servidor)
```

## 6. Crear el administrador y ejecutar la app

Crea el usuario administrador (usa la API oficial de Supabase, ya que
`supabase_admin.create_user` no existe en los proyectos nuevos):

```bash
npm install
npm run setup-admin
```

Salida esperada:

```
✔ Usuario administrador creado: admin@ucompensar.edu.co
  Contraseña inicial: **********
```

Ahora ejecuta la aplicación:

```bash
npm run dev
```

Abre `http://localhost:3000`:

- Regístrate con un correo `@ucompensar.edu.co` → confirma desde tu correo → empieza a diligenciar practicantes.
- O ingresa como administrador: `admin@ucompensar.edu.co` / `**********`.

> **Importante:** cambia la contraseña del admin después del primer ingreso en **Authentication → Users**.

> ¿Prefieres crearlo manualmente? En **Authentication → Users → Add user** crea
> `admin@ucompensar.edu.co` con "Auto confirm user" activado y luego ejecuta en el
> SQL Editor: `update public.profiles set role = 'admin' where email = 'admin@ucompensar.edu.co';`

## 7. Desplegar (Vercel, recomendado)

1. Sube este proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com): **Add New → Project** → importa el repositorio.
3. En **Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy. Luego en Supabase actualiza **Site URL** y **Redirect URLs** con `https://TU-DOMINIO.vercel.app`.

## 8. Estructura del proyecto

```
supabase/schema.sql                      → Script SQL (tablas, triggers, RLS)
scripts/setup-admin.mjs                  → Crea el usuario administrador (API oficial)
src/proxy.ts                             → Refresco de sesión y protección de rutas
src/lib/supabase/{client,server}.ts      → Clientes de Supabase (navegador / servidor)
src/lib/constants.ts                     → Listas de valores del Excel
src/app/(auth)/login                     → Inicio de sesión
src/app/(auth)/registro                  → Registro (solo @ucompensar.edu.co)
src/app/auth/confirm                     → Confirmación de correo
src/app/(app)/dashboard                  → Resumen con estadísticas
src/app/(app)/practicantes               → CRUD de practicantes del docente
src/app/(app)/practicantes/cargar        → Cargue masivo desde Excel (plantilla + subida)
src/app/(app)/admin                      → Vista de administrador (todo + filtros)
src/app/(auth)/acceso-estudiante         → Entrada del estudiante con código al correo
src/app/(estudiante)/mi-practica         → Espacio del estudiante (guía, datos, documentos)
src/lib/portal/guia.ts                   → Entregas de la guía y lo que se pide en cada una
src/app/api/export                       → Exportación a Excel (solo admin)
src/app/api/plantilla                    → Plantilla descargable para el cargue masivo
```

## Notas de seguridad

- Las claves `anon` se exponen en el navegador a propósito (es el modelo de Supabase): la seguridad real la dan las **políticas RLS**, que impiden leer/modificar practicantes de otros docentes.
- El registro con correo fuera de `@ucompensar.edu.co` se bloquea a nivel de aplicación **y** de base de datos (constraint).
- La exportación a Excel solo la puede ejecutar un usuario con rol `admin` (verificado en el servidor).
- Nadie puede asignarse un rol: el perfil ignora los metadatos del registro y la sesión del usuario no puede modificar la columna `role`.
- El estudiante no accede directamente a `practicantes`: su espacio lo atiende el servidor, filtrando por su correo verificado y sin exponer el estado oficial ni las observaciones del docente.
