# Migración de canciones · Supabase → PostgreSQL (Dokploy)

Descarga y migración de **solo las canciones** (`songs` + `song_slides`) desde el
Supabase actual hacia un PostgreSQL autohospedado en Dokploy.

Generado: 2026-09-26 · Origen: Supabase (PostgreSQL 17.6) · **80 canciones · 961 diapositivas**

## Archivos

| Archivo | Qué es |
| --- | --- |
| `01_schema.sql` | Esquema limpio y autocontenido (enum `slide_type`, función `set_updated_at`, tablas `songs` y `song_slides`, índices, triggers, FK interna). Listo para un Postgres nuevo. |
| `02_data.sql` | Los datos: 1041 `INSERT` (80 songs + 961 slides), en orden correcto para respetar la FK. |
| `songs_backup.dump` | Backup de **alta fidelidad** en formato custom de `pg_dump` (incluye RLS y FKs originales de Supabase). Solo para resguardo/rollback. |
| `songs.json` / `song_slides.json` | Export legible en JSON, como respaldo adicional. |

## Decisiones de la migración (importante)

Este destino es un Postgres plano, sin Supabase. Por eso el esquema **omite a propósito**:

- **Row Level Security y policies** — dependían de `auth.uid()` y de la tabla `workspace_members`.
- **FK `songs.created_by → auth.users`** — `auth.users` no existe fuera de Supabase Auth.
- **FK `songs.workspace_id → workspaces`** — la tabla `workspaces` no entra en esta migración (alcance "solo canciones").

Las columnas `workspace_id` y `created_by` **se conservan con sus valores** (uuid); solo se
quitan las llaves foráneas. **No se pierde ningún dato.** Todo lo demás (tipos, checks,
índices, triggers, FK `song_slides → songs`) se preserva idéntico.

## Restaurar en Dokploy

1. En Dokploy, crea (o ubica) el servicio **PostgreSQL** y obtén su cadena de conexión.
   Recomendado **PostgreSQL 17** para paridad con el origen (funciona en 14+; los archivos
   ya son portables).

2. Exporta la URL del destino y aplica los dos archivos en orden:

   ```bash
   export DOKPLOY_DB_URL='postgresql://USER:PASSWORD@HOST:PORT/DBNAME'

   psql "$DOKPLOY_DB_URL" -v ON_ERROR_STOP=1 -f 01_schema.sql
   psql "$DOKPLOY_DB_URL" -v ON_ERROR_STOP=1 -f 02_data.sql
   ```

   > Si el Postgres de Dokploy solo es alcanzable dentro de la red interna, corre estos
   > comandos desde un contenedor/host con acceso, o expón el puerto temporalmente.

3. Verifica:

   ```bash
   psql "$DOKPLOY_DB_URL" -c "select count(*) from songs;"        -- 80
   psql "$DOKPLOY_DB_URL" -c "select count(*) from song_slides;"  -- 961
   ```

## Conectar la app al nuevo Postgres

Migrar los datos es el primer paso. La app (`lib/supabase.ts`, `lib/supabase/browser.ts`)
hoy habla con Supabase vía `@supabase/supabase-js` usando la API REST (PostgREST), **no**
una conexión Postgres directa. Apuntar la app a Dokploy requiere una capa de acceso a datos
(p. ej. una API propia / Prisma / postgres.js), además de reemplazar **Supabase Auth** y
**Supabase Storage** (fondos de canciones). Eso es un paso aparte de esta migración de datos.

## Rollback

Los datos originales siguen intactos en Supabase. Para restaurar el backup de fidelidad en
cualquier Postgres:

```bash
pg_restore --no-owner --no-privileges -d "$TARGET_DB_URL" songs_backup.dump
```
