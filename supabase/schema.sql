-- ============================================================================
-- MATRIZ DE SEGUIMIENTO DE PRÁCTICAS - UCOMPENSAR
-- Ejecuta TODO este script en el SQL Editor de Supabase (Dashboard > SQL Editor)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) TABLA DE PERFILES (1:1 con auth.users)
--    El role define: 'docente' (llena sus practicantes) o 'admin' (ve todo y exporta)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'docente' check (role in ('docente', 'admin')),
  created_at timestamptz not null default now(),
  -- Solo se permite crear perfiles con correos de la UCompensar
  constraint perfiles_correo_ucompensar check (email ~* '@ucompensar\.edu\.co$')
);

-- ----------------------------------------------------------------------------
-- 2) TABLA DE PRACTICANTES (espejo de la matriz de Excel)
-- ----------------------------------------------------------------------------
create table if not exists public.practicantes (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid not null references public.profiles (id) on delete cascade,
  practica text check (practica in ('Prácticas I', 'Prácticas II', 'Prácticas III')),
  nombre_completo text,
  numero_documento text,
  programa_academico text check (programa_academico in (
    'Técnica Profesional en Programación de Aplicaciones de Software',
    'Tecnología en Desarrollo de Aplicaciones Web y Móviles',
    'Profesional en Ingeniería de Software'
  )),
  semestre smallint check (semestre between 4 and 10),
  correo_electronico text,
  empresa text,
  modalidad text check (modalidad in (
    'Contrato laboral',
    'Contrato de aprendizaje',
    'Convenio',
    'Social comunitaria',
    'Emprendimiento',
    'Consultoría'
  )),
  fecha_inicio date,
  fecha_fin date,
  tutor_empresa text,
  estado text check (estado in (
    'Vinculado',
    'No Iniciado',
    'Reprobado',
    'Ausente',
    'No vinculado',
    'Aprobado'
  )),
  motivo_reprobacion text,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Nota: si ya ejecutaste una versión anterior del script, agrega la columna
-- 'practica' (Prácticas I, II o III) con el siguiente comando (idempotente):
alter table public.practicantes
  add column if not exists practica text
  check (practica in ('Prácticas I', 'Prácticas II', 'Prácticas III'));

-- ----------------------------------------------------------------------------
-- 3) TRIGGERS
-- ----------------------------------------------------------------------------

-- 3a) Crear perfil automáticamente cuando se registra un usuario en auth.users
--     El rol NUNCA se toma de raw_user_meta_data: ese campo lo escribe el cliente
--     al registrarse, así que cualquiera podría declararse administrador.
--     - Cuenta con un token vigente de accesos_estudiante y correo en la matriz:
--       'estudiante'. Las crea el portal antes de enviar el código de acceso. No
--       se puede saber por la contraseña: Supabase genera una aleatoria en las
--       cuentas creadas desde el servidor. Tampoco por app_metadata o la
--       confirmación, que se escriben después de insertar la fila. El metadato
--       lo puede escribir el cliente, pero no conoce el token de la tabla.
--     - Todo lo demás: 'docente' (el constraint exige correo @ucompensar.edu.co).
--     - El admin se promueve aparte: ver scripts/setup-admin.mjs.
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_es_estudiante boolean := false;
begin
  if exists (
    select 1 from public.accesos_estudiante a
    where a.token::text = new.raw_user_meta_data ->> 'acceso_estudiante'
      and a.correo = lower(btrim(new.email))
      and a.creado_en > now() - interval '10 minutes'
  ) then
    select p.nombre_completo, true
      into v_nombre, v_es_estudiante
    from public.practicantes p
    where p.correo_normalizado = lower(btrim(new.email))
    order by p.created_at desc
    limit 1;
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(v_nombre, new.raw_user_meta_data ->> 'full_name', ''),
    case when v_es_estudiante then 'estudiante' else 'docente' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- 3b) Sincronizar cambios de correo en auth.users -> profiles
create or replace function public.handle_user_email_change ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = lower(new.email)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row execute function public.handle_user_email_change ();

-- 3c) Actualizar updated_at al modificar un practicante
create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_practicante_updated_at on public.practicantes;
create trigger set_practicante_updated_at
  before update on public.practicantes
  for each row execute function public.set_updated_at ();

-- ----------------------------------------------------------------------------
-- 4) FUNCIONES DE AUTORIZACIÓN
-- ----------------------------------------------------------------------------
create or replace function public.is_admin ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Docentes y administradores. Los estudiantes también son `authenticated`, por
-- eso las políticas de creación deben distinguirlos: su portal trabaja desde el
-- servidor y no necesita escribir en estas tablas con su propia sesión.
create or replace function public.es_personal ()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('docente', 'admin')
  );
$$;

-- ----------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.practicantes enable row level security;

-- 5a) PRIVILEGIOS EXPLÍCITOS (requerido en proyectos 2026: las tablas nuevas
--     ya no se exponen automáticamente a través de la Data API)
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select, insert, update, delete on public.practicantes to authenticated;

-- ---------- POLÍTICAS profiles ----------
drop policy if exists "perfil_leer_propio" on public.profiles;
create policy "perfil_leer_propio"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "perfil_admin_leer_todos" on public.profiles;
create policy "perfil_admin_leer_todos"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "perfil_actualizar_propio" on public.profiles;
create policy "perfil_actualizar_propio"
  on public.profiles for update
  using (id = auth.uid());

-- ---------- POLÍTICAS practicantes ----------
drop policy if exists "practicante_docente_leer" on public.practicantes;
create policy "practicante_docente_leer"
  on public.practicantes for select
  using (docente_id = auth.uid());

drop policy if exists "practicante_admin_leer_todos" on public.practicantes;
create policy "practicante_admin_leer_todos"
  on public.practicantes for select
  using (public.is_admin());

drop policy if exists "practicante_docente_crear" on public.practicantes;
create policy "practicante_docente_crear"
  on public.practicantes for insert
  with check (docente_id = auth.uid() and public.es_personal());

drop policy if exists "practicante_docente_editar" on public.practicantes;
create policy "practicante_docente_editar"
  on public.practicantes for update
  using (docente_id = auth.uid());

drop policy if exists "practicante_admin_editar_todo" on public.practicantes;
create policy "practicante_admin_editar_todo"
  on public.practicantes for update
  using (public.is_admin());

drop policy if exists "practicante_docente_eliminar" on public.practicantes;
create policy "practicante_docente_eliminar"
  on public.practicantes for delete
  using (docente_id = auth.uid());

drop policy if exists "practicante_admin_eliminar_todo" on public.practicantes;
create policy "practicante_admin_eliminar_todo"
  on public.practicantes for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 6) USUARIO ADMINISTRADOR
--    Nota: el esquema `supabase_admin` (supabase_admin.create_user) ya no
--    existe en los proyectos nuevos de Supabase. Crea el admin de UNA de
--    estas dos formas DESPUÉS de ejecutar este script:
--
--    OPCIÓN A (recomendada, automática):
--      1. Copia .env.local.example -> .env.local y agrega SUPABASE_SERVICE_ROLE_KEY
--         (Supabase: Project Settings > API > service_role).
--      2. Ejecuta:  npm run setup-admin
--      El script crea el usuario y promueve su perfil al rol 'admin'.
--
--    OPCIÓN B (manual):
--      1. Dashboard > Authentication > Users > "Add user":
--         email: admin@ucompensar.edu.co, contraseña segura y "Auto confirm user" ON.
--      2. Promuévelo a administrador ejecutando:
--         update public.profiles set role = 'admin'
--         where email = 'admin@ucompensar.edu.co';
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 7) SOPORTES DE PRACTICANTES + CONEXIÓN CON SHAREPOINT / ONEDRIVE
--    Cada docente conecta SU propia cuenta de Microsoft (OAuth delegado) e
--    indica la carpeta de SharePoint donde se guardarán los soportes.
--    La app crea dentro de esa carpeta una subcarpeta por estudiante.
-- ----------------------------------------------------------------------------

-- 7a) Parámetros de la carpeta del docente (columna a columna, idempotente)
alter table public.profiles
  add column if not exists sharepoint_carpeta_url text;
alter table public.profiles
  add column if not exists sharepoint_drive_id text;
alter table public.profiles
  add column if not exists sharepoint_item_id text;
alter table public.profiles
  add column if not exists sharepoint_carpeta_nombre text;
alter table public.profiles
  add column if not exists microsoft_email text;

-- 7b) Tokens de Microsoft.
--     TABLA SENSIBLE: guarda el refresh token del docente. No se otorga ningún
--     privilegio a anon/authenticated, así que jamás es visible desde el
--     navegador; solo el servidor la usa con la service_role key.
create table if not exists public.microsoft_conexiones (
  docente_id uuid primary key references public.profiles (id) on delete cascade,
  cuenta_email text,
  refresh_token text not null,
  scope text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.microsoft_conexiones enable row level security;
revoke all on public.microsoft_conexiones from anon, authenticated;

-- 7c) Soportes subidos por practicante
create table if not exists public.soportes (
  id uuid primary key default gen_random_uuid(),
  practicante_id uuid not null references public.practicantes (id) on delete cascade,
  docente_id uuid not null references public.profiles (id) on delete cascade,
  nombre_archivo text not null,
  descripcion text,
  tamano_bytes bigint,
  tipo_mime text,
  carpeta text,
  sharepoint_item_id text,
  web_url text,
  subido_en timestamptz not null default now()
);

create index if not exists soportes_practicante_idx
  on public.soportes (practicante_id);

alter table public.soportes enable row level security;
grant select, insert, update, delete on public.soportes to authenticated;

drop policy if exists "soporte_docente_leer" on public.soportes;
create policy "soporte_docente_leer"
  on public.soportes for select
  using (docente_id = auth.uid());

drop policy if exists "soporte_admin_leer_todos" on public.soportes;
create policy "soporte_admin_leer_todos"
  on public.soportes for select
  using (public.is_admin());

drop policy if exists "soporte_docente_crear" on public.soportes;
create policy "soporte_docente_crear"
  on public.soportes for insert
  with check (docente_id = auth.uid() and public.es_personal());

drop policy if exists "soporte_docente_eliminar" on public.soportes;
create policy "soporte_docente_eliminar"
  on public.soportes for delete
  using (docente_id = auth.uid());

drop policy if exists "soporte_admin_eliminar_todo" on public.soportes;
create policy "soporte_admin_eliminar_todo"
  on public.soportes for delete
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8) DESTINO ALTERNATIVO: FLUJO DE POWER AUTOMATE
--    Cuando el tenant no permite registrar una app en Entra ID, el docente
--    crea un flujo propio con disparador HTTP que escribe en su OneDrive.
--    La URL del disparador lleva firma (sig=) y ES UNA CREDENCIAL: se guarda
--    en una tabla sin privilegios para anon/authenticated, igual que los
--    refresh tokens de Microsoft.
-- ----------------------------------------------------------------------------
create table if not exists public.flujos_soportes (
  docente_id uuid primary key references public.profiles (id) on delete cascade,
  url text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.flujos_soportes enable row level security;
revoke all on public.flujos_soportes from anon, authenticated;

-- Bandera no sensible para que la interfaz sepa si ya hay flujo configurado
alter table public.profiles
  add column if not exists flujo_configurado boolean not null default false;

-- Origen de cada soporte: define si se puede borrar el archivo remoto
alter table public.soportes
  add column if not exists destino text not null default 'microsoft'
  check (destino in ('microsoft', 'power_automate'));

-- ----------------------------------------------------------------------------
-- 9) COMUNICACIONES MASIVAS (TEAMS + CORREO) VÍA POWER AUTOMATE
--    El docente escribe un mensaje con variables ({nombre}, {empresa}…), la
--    app lo personaliza por estudiante y lo envía a un segundo flujo del
--    docente que publica en Teams o manda el correo desde su Outlook.
-- ----------------------------------------------------------------------------

-- 9a) URL del flujo (credencial, solo servidor)
create table if not exists public.flujos_comunicaciones (
  docente_id uuid primary key references public.profiles (id) on delete cascade,
  url text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.flujos_comunicaciones enable row level security;
revoke all on public.flujos_comunicaciones from anon, authenticated;

alter table public.profiles
  add column if not exists flujo_comunicaciones_configurado boolean not null default false;

-- 9b) Cada comunicación (la plantilla tal como la escribió el docente)
create table if not exists public.comunicaciones (
  id uuid primary key default gen_random_uuid(),
  docente_id uuid not null references public.profiles (id) on delete cascade,
  asunto text not null,
  mensaje text not null,
  canales text[] not null,
  total_destinatarios integer not null default 0,
  creado_en timestamptz not null default now()
);

-- Practicantes elegidos, para poder completar un envío que se interrumpió
alter table public.comunicaciones
  add column if not exists destinatarios uuid[] not null default '{}';

create index if not exists comunicaciones_docente_idx
  on public.comunicaciones (docente_id, creado_en desc);

alter table public.comunicaciones enable row level security;
grant select, insert on public.comunicaciones to authenticated;

drop policy if exists "comunicacion_docente_leer" on public.comunicaciones;
create policy "comunicacion_docente_leer"
  on public.comunicaciones for select
  using (docente_id = auth.uid());

drop policy if exists "comunicacion_admin_leer_todas" on public.comunicaciones;
create policy "comunicacion_admin_leer_todas"
  on public.comunicaciones for select
  using (public.is_admin());

drop policy if exists "comunicacion_docente_crear" on public.comunicaciones;
create policy "comunicacion_docente_crear"
  on public.comunicaciones for insert
  with check (docente_id = auth.uid() and public.es_personal());

-- 9c) Resultado por estudiante y canal (una fila por intento vigente)
create table if not exists public.comunicacion_envios (
  id uuid primary key default gen_random_uuid(),
  comunicacion_id uuid not null references public.comunicaciones (id) on delete cascade,
  docente_id uuid not null references public.profiles (id) on delete cascade,
  practicante_id uuid references public.practicantes (id) on delete set null,
  nombre text,
  correo text,
  canal text not null check (canal in ('teams', 'correo')),
  estado text not null check (estado in ('enviado', 'fallido', 'omitido')),
  error text,
  enviado_en timestamptz not null default now(),
  unique (comunicacion_id, practicante_id, canal)
);

alter table public.comunicacion_envios enable row level security;
grant select, insert, update on public.comunicacion_envios to authenticated;

drop policy if exists "envio_docente_leer" on public.comunicacion_envios;
create policy "envio_docente_leer"
  on public.comunicacion_envios for select
  using (docente_id = auth.uid());

drop policy if exists "envio_admin_leer_todos" on public.comunicacion_envios;
create policy "envio_admin_leer_todos"
  on public.comunicacion_envios for select
  using (public.is_admin());

drop policy if exists "envio_docente_crear" on public.comunicacion_envios;
create policy "envio_docente_crear"
  on public.comunicacion_envios for insert
  with check (docente_id = auth.uid() and public.es_personal());

drop policy if exists "envio_docente_actualizar" on public.comunicacion_envios;
create policy "envio_docente_actualizar"
  on public.comunicacion_envios for update
  using (docente_id = auth.uid());

-- 9d) Imágenes adjuntas a una comunicación. Se guardan para que "Reintentar
--     fallidos" y "Enviar a los que faltan" las vuelvan a mandar. Van como
--     adjuntos del correo (el chat de Teams del bot de flujo no los admite).
--     Solo el servidor las toca: comprueba antes que la comunicación sea del
--     docente de la sesión.
create table if not exists public.comunicacion_adjuntos (
  id uuid primary key default gen_random_uuid(),
  comunicacion_id uuid not null references public.comunicaciones (id) on delete cascade,
  nombre text not null,
  tipo_mime text not null,
  tamano_bytes integer not null,
  contenido_base64 text not null,
  creado_en timestamptz not null default now()
);

create index if not exists comunicacion_adjuntos_comunicacion_idx
  on public.comunicacion_adjuntos (comunicacion_id);

alter table public.comunicacion_adjuntos enable row level security;
revoke all on public.comunicacion_adjuntos from anon, authenticated;
grant select, insert, delete on public.comunicacion_adjuntos to service_role;

-- ----------------------------------------------------------------------------
-- 10) PORTAL DEL ESTUDIANTE
--    El estudiante entra con un código enviado a su correo, completa los datos
--    que faltan, sube sus documentos e indica en qué paso va. Su portal NO usa
--    RLS sobre practicantes: lo atiende el servidor con la service_role, filtrando
--    por el correo verificado de la sesión y limitando los campos, porque RLS no
--    puede impedir que con su propia sesión se cambie, por ejemplo, el `estado`.
-- ----------------------------------------------------------------------------

-- 10a) Nuevo rol. Los estudiantes pueden tener correo personal: el docente los
--      registra con el correo que tenga, no siempre el institucional.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('docente', 'admin', 'estudiante'));

alter table public.profiles drop constraint if exists perfiles_correo_ucompensar;
alter table public.profiles
  add constraint perfiles_correo_ucompensar
  check (role = 'estudiante' or email ~* '@ucompensar\.edu\.co$');

-- 10b) Nadie puede cambiar su propio rol: de la tabla profiles, la sesión del
--      usuario solo puede actualizar estas columnas. Las banderas de los flujos
--      las escribe el servidor con la service_role.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (
  full_name,
  sharepoint_carpeta_url,
  sharepoint_drive_id,
  sharepoint_item_id,
  sharepoint_carpeta_nombre
) on public.profiles to authenticated;

-- 10c) Avance que reporta el estudiante. Es distinto de `estado`, que sigue
--      siendo el resultado oficial que define el docente.
alter table public.practicantes
  add column if not exists avance text
  check (avance in ('Inicio', 'En curso', 'Finalizado'));
alter table public.practicantes
  add column if not exists avance_actualizado_en timestamptz;

-- 10d) Correo normalizado: en la matriz puede venir con mayúsculas o espacios
--      (sobre todo desde Excel). Es la llave que une la sesión con el practicante.
alter table public.practicantes
  add column if not exists correo_normalizado text
  generated always as (lower(btrim(correo_electronico))) stored;

create index if not exists practicantes_correo_normalizado_idx
  on public.practicantes (correo_normalizado);

-- 10e) Soportes: a qué documento de la guía corresponde y quién lo subió
alter table public.soportes
  add column if not exists tipo_documento text;
alter table public.soportes
  add column if not exists subido_por text not null default 'docente'
  check (subido_por in ('docente', 'estudiante'));

-- 10f) Formularios externos que el estudiante declara haber diligenciado (ids de
--      src/lib/portal/guia.ts). Las evidencias van a soportes como cualquier otro
--      archivo, con el id del formulario en tipo_documento.
alter table public.practicantes
  add column if not exists formularios_diligenciados text[] not null default '{}';

-- 10g) Tokens de un solo uso con los que el servidor le indica a handle_new_user
--      que la cuenta la está creando el portal. Solo los toca la service_role.
create table if not exists public.accesos_estudiante (
  token uuid primary key,
  correo text not null,
  creado_en timestamptz not null default now()
);

alter table public.accesos_estudiante enable row level security;
revoke all on public.accesos_estudiante from anon, authenticated;
grant select, insert, delete on public.accesos_estudiante to service_role;

-- 10h) Estudiantes que no alcanzan a terminar en el semestre y siguen en el
--      intersemestral que ofreció la universidad (nov 2026). Es una marca del
--      docente, aparte de `estado` y `avance`.
alter table public.practicantes
  add column if not exists intersemestral boolean not null default false;

-- 10i) Registros de prueba (para validar la app, p. ej. con el correo propio del
--      docente). No cuentan en el dashboard, los totales ni el Excel exportado.
alter table public.practicantes
  add column if not exists prueba boolean not null default false;

-- 10j) Entregables que el docente marca como recibidos (ids de
--      src/lib/portal/guia.ts), p. ej. cuando el estudiante los mandó por correo.
--      Cuentan como cumplidos aunque no haya archivo en soportes. El estudiante
--      solo los lee (el portal usa la service_role con lista cerrada de columnas).
alter table public.practicantes
  add column if not exists requisitos_recibidos text[] not null default '{}';

-- Que la Data API vea de inmediato las columnas nuevas
notify pgrst, 'reload schema';
