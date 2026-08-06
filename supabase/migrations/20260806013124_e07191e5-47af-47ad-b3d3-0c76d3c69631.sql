ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS token_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao timestamptz,
  ADD COLUMN IF NOT EXISTS erro_sincronizacao text,
  ADD COLUMN IF NOT EXISTS acao_lead text,
  ADD COLUMN IF NOT EXISTS acao_conversao text;

CREATE TABLE IF NOT EXISTS public.clientes_secrets (
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  meta_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.clientes_secrets TO service_role;
ALTER TABLE public.clientes_secrets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.metricas_diarias
  ADD COLUMN IF NOT EXISTS acoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS metricas_diarias_cliente_data_key
  ON public.metricas_diarias (cliente_id, data);