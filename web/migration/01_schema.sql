-- ============================================================================
-- Nova · Migración de canciones  Supabase → PostgreSQL (Dokploy)
-- Archivo 1/2: ESQUEMA (limpio, autocontenido, sin dependencias de Supabase)
--
-- Alcance: SOLO canciones (songs + song_slides).
-- Diferencias vs. el esquema original de Supabase (a propósito):
--   * SIN Row Level Security ni policies (dependían de auth.uid() / workspace_members).
--   * SIN FK songs.created_by  -> auth.users     (no existe fuera de Supabase Auth).
--   * SIN FK songs.workspace_id -> workspaces     (tabla no incluida en esta migración).
--     -> Las columnas workspace_id y created_by SE CONSERVAN con sus valores (uuid),
--        solo se quitan las llaves foráneas. No se pierde ningún dato.
-- Todo lo demás (tipos, checks, índices, triggers, FK song_slides->songs) se preserva.
-- ============================================================================

BEGIN;

-- 1) Tipo enum usado por song_slides.type ---------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slide_type') THEN
    CREATE TYPE public.slide_type AS ENUM (
      'verse', 'chorus', 'bridge', 'prechorus', 'tag', 'intro', 'outro', 'ending', 'other'
    );
  END IF;
END $$;

-- 2) Función de trigger para updated_at -----------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 3) Tabla songs ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.songs (
    id              uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id    uuid NOT NULL,
    created_by      uuid,
    title           text NOT NULL,
    author          text,
    tonality        text,
    bpm             integer,
    is_archived     boolean DEFAULT false NOT NULL,
    created_at      timestamp with time zone DEFAULT now() NOT NULL,
    updated_at      timestamp with time zone DEFAULT now() NOT NULL,
    typography      jsonb,
    background_type text DEFAULT 'none'::text,
    background_url  text,
    CONSTRAINT songs_pkey PRIMARY KEY (id),
    CONSTRAINT songs_background_type_check
        CHECK (background_type = ANY (ARRAY['none'::text, 'image'::text, 'video'::text]))
);

-- 4) Tabla song_slides ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.song_slides (
    id             uuid DEFAULT gen_random_uuid() NOT NULL,
    song_id        uuid NOT NULL,
    "position"     integer NOT NULL,
    type           public.slide_type NOT NULL,
    label          text,
    content        text NOT NULL,
    created_at     timestamp with time zone DEFAULT now() NOT NULL,
    updated_at     timestamp with time zone DEFAULT now() NOT NULL,
    font_size      integer DEFAULT 64 NOT NULL,
    line_height    numeric,
    letter_spacing numeric,
    CONSTRAINT song_slides_pkey PRIMARY KEY (id),
    CONSTRAINT song_slides_unique_position UNIQUE (song_id, "position"),
    CONSTRAINT song_slides_song_id_fkey
        FOREIGN KEY (song_id) REFERENCES public.songs(id) ON DELETE CASCADE
);

-- 5) Índices --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_songs_title       ON public.songs       USING btree (title);
CREATE INDEX IF NOT EXISTS idx_songs_workspace   ON public.songs       USING btree (workspace_id);
CREATE INDEX IF NOT EXISTS idx_song_slides_song  ON public.song_slides USING btree (song_id);
CREATE INDEX IF NOT EXISTS idx_song_slides_type  ON public.song_slides USING btree (type);

-- 6) Triggers -------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_songs_updated_at ON public.songs;
CREATE TRIGGER trg_songs_updated_at
    BEFORE UPDATE ON public.songs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_song_slides_updated_at ON public.song_slides;
CREATE TRIGGER trg_song_slides_updated_at
    BEFORE UPDATE ON public.song_slides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
