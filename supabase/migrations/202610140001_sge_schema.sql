-- SGE Admin: esquema inicial. Revisar y ejecutar en el proyecto Supabase destino.
create extension if not exists pgcrypto;

create type public.tipo_documento as enum (
  'Memorándum', 'Oficio', 'Citatorio Grupal',
  'Citatorio Personal', 'Circular', 'Acta de Hechos'
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  tipo_documento public.tipo_documento not null,
  anio_folio integer not null check (anio_folio between 2000 and 2200),
  consecutivo integer not null check (consecutivo > 0),
  folio text not null unique,
  fecha_creacion timestamptz not null default now(),
  fecha_documento date not null default current_date,
  destinatario text not null check (char_length(trim(destinatario)) between 1 and 250),
  asunto_tema text not null check (char_length(trim(asunto_tema)) between 1 and 300),
  contenido text not null default '' check (char_length(contenido) <= 20000),
  archivo_pdf_path text,
  estado text not null default 'Borrador' check (estado in ('Borrador','Generado','Enviado','Archivado')),
  unique (tipo_documento, anio_folio, consecutivo)
);

create table public.contadores_folio (
  tipo_documento public.tipo_documento not null,
  anio_folio integer not null,
  ultimo_consecutivo integer not null default 0 check (ultimo_consecutivo >= 0),
  primary key (tipo_documento, anio_folio)
);

create table public.plantillas (
  id uuid primary key default gen_random_uuid(),
  tipo_documento public.tipo_documento not null unique,
  nombre text not null,
  encabezado text not null default 'SISTEMA DE GESTIÓN ESCOLAR',
  contenido_base text not null default '',
  pie_firma text not null default 'Nombre y firma',
  activa boolean not null default true,
  actualizada_en timestamptz not null default now()
);

alter table public.documentos enable row level security;
alter table public.contadores_folio enable row level security;
alter table public.plantillas enable row level security;

create policy "usuarios autenticados ven sus documentos"
  on public.documentos for select to authenticated
  using ((select auth.uid()) = usuario_id);
create policy "usuarios autenticados actualizan sus documentos"
  on public.documentos for update to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);
-- Las inserciones se hacen exclusivamente mediante la función transaccional.
revoke insert on public.documentos from anon, authenticated;
revoke all on public.contadores_folio from anon, authenticated;
create policy "usuarios autenticados leen plantillas activas"
  on public.plantillas for select to authenticated
  using (activa = true);

-- Función transaccional: el upsert del contador serializa asignaciones concurrentes
-- por tipo/año; las restricciones UNIQUE protegen contra duplicados.
create or replace function public.crear_documento_con_folio(
  p_tipo_documento public.tipo_documento,
  p_fecha_documento date,
  p_destinatario text,
  p_asunto_tema text,
  p_contenido text default ''
)
returns table (id uuid, folio text, tipo_documento public.tipo_documento, fecha_creacion timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_year integer := extract(year from p_fecha_documento)::integer;
  v_next integer;
  v_prefix text;
  v_id uuid;
  v_folio text;
  v_created timestamptz;
begin
  if v_user is null then
    raise exception 'Debes iniciar sesión para crear documentos' using errcode = '28000';
  end if;
  if p_destinatario is null or char_length(trim(p_destinatario)) not between 1 and 250 then
    raise exception 'El destinatario es obligatorio (máximo 250 caracteres)' using errcode = '22023';
  end if;
  if p_asunto_tema is null or char_length(trim(p_asunto_tema)) not between 1 and 300 then
    raise exception 'El asunto es obligatorio (máximo 300 caracteres)' using errcode = '22023';
  end if;
  v_prefix := case p_tipo_documento
    when 'Memorándum' then 'MEM'
    when 'Oficio' then 'OF'
    when 'Citatorio Grupal' then 'CIT-G'
    when 'Citatorio Personal' then 'CIT-P'
    when 'Circular' then 'CIR'
    when 'Acta de Hechos' then 'ACT'
  end;
  insert into public.contadores_folio(tipo_documento, anio_folio, ultimo_consecutivo)
  values (p_tipo_documento, v_year, 1)
  on conflict (tipo_documento, anio_folio)
  do update set ultimo_consecutivo = public.contadores_folio.ultimo_consecutivo + 1
  returning ultimo_consecutivo into v_next;
  v_folio := v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
  insert into public.documentos(usuario_id, tipo_documento, anio_folio, consecutivo, folio,
    fecha_documento, destinatario, asunto_tema, contenido)
  values (v_user, p_tipo_documento, v_year, v_next, v_folio,
    p_fecha_documento, trim(p_destinatario), trim(p_asunto_tema), coalesce(p_contenido, ''))
  returning documentos.id, documentos.fecha_creacion into v_id, v_created;
  return query select v_id, v_folio, p_tipo_documento, v_created;
end;
$$;

revoke all on function public.crear_documento_con_folio(public.tipo_documento, date, text, text, text) from public, anon;
grant execute on function public.crear_documento_con_folio(public.tipo_documento, date, text, text, text) to authenticated;

insert into public.plantillas(tipo_documento, nombre, contenido_base) values
('Memorándum','Plantilla de memorándum','Por medio del presente se informa que [DESCRIBIR EL MOTIVO]. Se solicita su atención y seguimiento correspondiente.'),
('Oficio','Plantilla de oficio','Por este conducto me permito dirigirme a usted para [DESCRIBIR SOLICITUD O ASUNTO]. Sin otro particular, agradezco su atención.'),
('Citatorio Grupal','Plantilla de citatorio grupal','Se convoca a madres, padres y tutores a la reunión que se llevará a cabo el día [FECHA] a las [HORA] en [LUGAR], para tratar asuntos relacionados con [ASUNTO].'),
('Citatorio Personal','Plantilla de citatorio personal','Por medio del presente se solicita su presencia el día [FECHA] a las [HORA] para tratar asuntos relacionados con el/la estudiante y dar seguimiento oportuno.'),
('Circular','Plantilla de circular','Se comunica a la comunidad escolar que [COMUNICADO]. Agradecemos su atención y colaboración.'),
('Acta de Hechos','Plantilla de acta de hechos','En las instalaciones del plantel, siendo las [HORA] del día [FECHA], se hace constar lo siguiente: [DESCRIPCIÓN OBJETIVA DE LOS HECHOS]. Se levanta la presente para los efectos administrativos correspondientes.')
on conflict (tipo_documento) do nothing;

-- Bucket privado: acceso limitado al usuario propietario de la carpeta.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('documentos-pdf', 'documentos-pdf', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "usuario ve sus propios PDF"
on storage.objects for select to authenticated
using (bucket_id = 'documentos-pdf' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "usuario sube sus propios PDF"
on storage.objects for insert to authenticated
with check (bucket_id = 'documentos-pdf' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "usuario actualiza sus propios PDF"
on storage.objects for update to authenticated
using (bucket_id = 'documentos-pdf' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'documentos-pdf' and (storage.foldername(name))[1] = (select auth.uid())::text);

grant select, update on public.documentos to authenticated;
grant select on public.plantillas to authenticated;
