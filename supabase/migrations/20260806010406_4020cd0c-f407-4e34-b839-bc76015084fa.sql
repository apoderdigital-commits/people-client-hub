-- Integração com a Meta Ads.
--
-- 1. O token de anúncios sai de `clientes`. A policy "equipe ve clientes" dá
--    SELECT a qualquer conta com role = 'agencia' — inclusive designer e editor
--    de vídeo — e a tela enviava o token para o navegador. Ele passa a viver em
--    `clientes_secrets`, sem policy alguma e sem grant para `authenticated`:
--    apenas a service_role (que ignora RLS) alcança a tabela.
--
-- 2. `metricas_diarias` passa a guardar todas as ações devolvidas pela Meta em
--    `acoes`. Assim, mudar o que conta como "lead" é uma troca de configuração
--    e não exige puxar o histórico de novo.

CREATE TABLE IF NOT EXISTS public.clientes_secrets (
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  meta_token text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clientes_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.clientes_secrets TO service_role;
-- Sem CREATE POLICY: com RLS ativo e nenhuma policy, ninguém que passe pelo
-- PostgREST enxerga esta tabela. A service_role não é submetida ao RLS.

-- Preserva tokens já cadastrados antes de remover a coluna.
INSERT INTO public.clientes_secrets (cliente_id, meta_token)
SELECT id, meta_token
FROM public.clientes
WHERE COALESCE(meta_token, '') <> ''
ON CONFLICT (cliente_id) DO NOTHING;

ALTER TABLE public.clientes DROP COLUMN IF EXISTS meta_token;

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS token_atualizado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacao timestamptz,
  ADD COLUMN IF NOT EXISTS erro_sincronizacao   text,
  ADD COLUMN IF NOT EXISTS acao_lead            text,
  ADD COLUMN IF NOT EXISTS acao_conversao       text;

UPDATE public.clientes c
SET token_atualizado_em = now()
WHERE c.token_atualizado_em IS NULL
  AND EXISTS (
    SELECT 1 FROM public.clientes_secrets s
    WHERE s.cliente_id = c.id AND s.meta_token <> ''
  );

ALTER TABLE public.metricas_diarias
  ADD COLUMN IF NOT EXISTS acoes         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

-- Vínculo real com clientes. Sem DELETE prévio de propósito: se houver métrica
-- órfã, é melhor a migration falhar e alguém olhar do que apagar dado em
-- silêncio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metricas_diarias_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.metricas_diarias
      ADD CONSTRAINT metricas_diarias_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
  END IF;
END $$;
