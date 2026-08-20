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
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'docente')
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

-- ----------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.practicantes enable row level security;

-- 5a) PRIVILEGIOS EXPLÍCITOS (requerido en proyectos 2026: las tablas nuevas
--     ya no se exponen automáticamente a través de la Data API)
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
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
  with check (docente_id = auth.uid());

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
--      El trigger handle_new_user creará el perfil automáticamente con rol 'admin'.
--
--    OPCIÓN B (manual):
--      1. Dashboard > Authentication > Users > "Add user":
--         email: admin@ucompensar.edu.co, contraseña segura y "Auto confirm user" ON.
--      2. Promuévelo a administrador ejecutando:
--         update public.profiles set role = 'admin'
--         where email = 'admin@ucompensar.edu.co';
-- ----------------------------------------------------------------------------