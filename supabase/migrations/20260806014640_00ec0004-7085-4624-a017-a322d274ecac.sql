-- Métricas por campanha + alinhamento do schema.
--
-- A dashboard precisa filtrar por campanha, o que exige guardar os insights
-- quebrados por campanha e não só o total da conta. As demais mudanças
-- reconciliam o banco com o que a migration da integração pretendia: a versão
-- aplicada divergiu em alguns pontos.

CREATE TABLE IF NOT EXISTS public.metricas_campanhas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  campanha_id   text NOT NULL,
  campanha_nome text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT '',
  data          date NOT NULL,
  investimento  numeric NOT NULL DEFAULT 0,
  impressoes    integer NOT NULL DEFAULT 0,
  cliques       integer NOT NULL DEFAULT 0,
  leads         integer NOT NULL DEFAULT 0,
  conversoes    integer NOT NULL DEFAULT 0,
  acoes         jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, campanha_id, data)
);

GRANT SELECT ON public.metricas_campanhas TO authenticated;
GRANT ALL    ON public.metricas_campanhas TO service_role;
ALTER TABLE public.metricas_campanhas ENABLE ROW LEVEL SECURITY;

-- Mesmas regras de metricas_diarias: o cliente vê só o que é dele.
DROP POLICY IF EXISTS "cliente ve suas campanhas" ON public.metricas_campanhas;
CREATE POLICY "cliente ve suas campanhas" ON public.metricas_campanhas
  FOR SELECT TO authenticated
  USING (cliente_id = public.current_cliente_id());

DROP POLICY IF EXISTS "agencia ve todas campanhas" ON public.metricas_campanhas;
CREATE POLICY "agencia ve todas campanhas" ON public.metricas_campanhas
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agencia'));

CREATE INDEX IF NOT EXISTS metricas_campanhas_cliente_data_idx
  ON public.metricas_campanhas (cliente_id, data);

-- --- alinhamento ---

-- O código grava um objeto ({"lead": 3}), não um array.
ALTER TABLE public.metricas_diarias ALTER COLUMN acoes SET DEFAULT '{}'::jsonb;

-- Camada extra sobre o RLS: sem grant, nem uma policy acidental exporia o token.
REVOKE ALL ON public.clientes_secrets FROM PUBLIC, anon, authenticated;

-- A coluna antiga do token continua legível por toda a equipe. Preserva o que
-- houver antes de removê-la.
INSERT INTO public.clientes_secrets (cliente_id, meta_token)
SELECT id, meta_token
FROM public.clientes
WHERE COALESCE(meta_token, '') <> ''
ON CONFLICT (cliente_id) DO NOTHING;

ALTER TABLE public.clientes DROP COLUMN IF EXISTS meta_token;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metricas_diarias_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.metricas_diarias
      ADD CONSTRAINT metricas_diarias_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE CASCADE;
  END IF;

  -- Índice único redundante: a tabela já nasceu com UNIQUE (cliente_id, data).
  -- Só removemos se a constraint original de fato existir.
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.metricas_diarias'::regclass AND contype = 'u'
      AND conname <> 'metricas_diarias_cliente_data_key'
  ) THEN
    DROP INDEX IF EXISTS public.metricas_diarias_cliente_data_key;
  END IF;
END $$;
