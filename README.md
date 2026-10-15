# SGE Admin — Sistema de Gestión Escolar

Aplicación inicial en Next.js + TypeScript + Tailwind CSS + Supabase para centralizar documentos administrativos escolares.

## Incluye

- Inicio de sesión con Supabase Auth (sin registro público).
- Dashboard con estadísticas calculadas desde PostgreSQL.
- Seis tipos de documentos y plantillas iniciales en español.
- Creación con folio consecutivo asignado en una función transaccional de PostgreSQL.
- Edición, búsqueda por texto/folio, filtros por tipo y rango de fechas.
- Generación y descarga local de PDF.
- Carga opcional del PDF a un bucket privado de Supabase Storage.
- RLS en tablas y políticas por propietario para documentos y PDFs.

## 1. Requisitos

- Node.js 20.9+ (recomendado).
- Un proyecto Supabase.
- Repositorio privado de GitHub y cuenta Vercel.

## 2. Configurar Supabase

1. En Supabase, abre **SQL Editor**.
2. Ejecuta el archivo `supabase/migrations/202610140001_sge_schema.sql` en un proyecto nuevo o previamente revisado. No lo ejecutes sin revisar si ya existen tablas/tipos con esos nombres.
3. En **Authentication → Users**, crea la cuenta de administrador. El sistema no ofrece registro público.
4. En **Project Settings → API**, copia la URL del proyecto y la publishable key.
5. Configura `.env.local` usando `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE
```

Nunca uses `service_role` ni una secret key en variables `NEXT_PUBLIC_*`.

## 3. Ejecutar localmente

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## 4. Publicar

1. Sube el contenido del proyecto a un repositorio **privado** en GitHub.
2. En Vercel, importa ese repositorio y selecciona Next.js.
3. Agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en Development, Preview y Production.
4. Despliega desde la rama principal.

## 5. Convención de folios

Se genera `PREFIJO-AAAA-0001` por tipo y año, por ejemplo `OF-2026-0001` o `MEM-2026-0001`. Cada combinación tipo/año tiene su contador transaccional. Si el colegio ya usa una convención oficial, cambia prefijos/formato antes de producción.

## 6. Consideraciones antes de producción

- Confirmar el formato oficial de folios, nombre/logo del colegio, encabezados, pies de firma y campos obligatorios por tipo.
- Validar la migración en un proyecto Supabase destino; está diseñada como migración inicial, no como actualización idempotente de un esquema existente.
- Los documentos se aíslan por usuario (`usuario_id`). Si todo el personal debe compartir el mismo historial, debe definirse un modelo de roles/plantel y actualizar RLS antes de habilitar más cuentas.
- El PDF usa encabezado genérico y firma en blanco. Requiere revisión del colegio para que sea oficial.
- Probar login, RLS, concurrencia de folios, creación/edición, PDF, Storage, filtros y restauración antes de usar datos reales.
- No cargar datos sensibles de estudiantes en un entorno de demostración.

## 7. Flujo de folios

El frontend no calcula folios. Llama `crear_documento_con_folio`; PostgreSQL incrementa el contador con `INSERT ... ON CONFLICT DO UPDATE` y crea el documento en la misma transacción. Hay restricciones únicas para proteger la integridad del folio.
