ALTER TABLE public.user_articles
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_rating smallint
    CHECK (ai_rating IS NULL OR (ai_rating >= 1 AND ai_rating <= 10)),
  ADD COLUMN IF NOT EXISTS ai_rating_reason text,
  ADD COLUMN IF NOT EXISTS ai_rated_at timestamptz;

COMMENT ON COLUMN public.user_articles.ai_summary IS 'Resumen generado por Ollama para este usuario';
COMMENT ON COLUMN public.user_articles.ai_rating IS 'Valoración 1-10 según preferencias al guardar';
COMMENT ON COLUMN public.user_articles.ai_rating_reason IS 'Razón breve de la valoración';
COMMENT ON COLUMN public.user_articles.ai_rated_at IS 'Cuándo se completó la valoración IA';
