CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id text PRIMARY KEY,
  preferences_text text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_preferences IS 'Prompt de gustos del usuario para personalizar valoración IA';
COMMENT ON COLUMN public.user_preferences.preferences_text IS 'Texto libre con temas de interés y estilos a evitar';

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
