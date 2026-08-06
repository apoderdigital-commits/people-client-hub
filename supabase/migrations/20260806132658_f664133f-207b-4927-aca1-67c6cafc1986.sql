-- Fluxo People: quadro de produção do time.
--
-- Colunas são dados, não código, para que a equipe ajuste o processo sem
-- depender de deploy. A permissão fina (ver / editar a aba "fluxo") é aplicada
-- na interface, como nas demais abas; o RLS aqui autoriza a equipe como um
-- todo, mesmo padrão já usado em `clientes`.

CREATE TABLE IF NOT EXISTS public.fluxo_colunas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,
  ordem      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fluxo_cartoes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coluna_id  uuid NOT NULL REFERENCES public.fluxo_colunas(id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  prazo      date,
  ordem      integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fluxo_responsaveis (
  cartao_id uuid NOT NULL REFERENCES public.fluxo_cartoes(id) ON DELETE CASCADE,
  perfil_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, perfil_id)
);

CREATE INDEX IF NOT EXISTS fluxo_cartoes_coluna_idx
  ON public.fluxo_cartoes (coluna_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_colunas      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_cartoes      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_responsaveis TO authenticated;
GRANT ALL ON public.fluxo_colunas      TO service_role;
GRANT ALL ON public.fluxo_cartoes      TO service_role;
GRANT ALL ON public.fluxo_responsaveis TO service_role;

ALTER TABLE public.fluxo_colunas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_cartoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipe usa colunas do fluxo" ON public.fluxo_colunas;
CREATE POLICY "equipe usa colunas do fluxo" ON public.fluxo_colunas
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

DROP POLICY IF EXISTS "equipe usa cartoes do fluxo" ON public.fluxo_cartoes;
CREATE POLICY "equipe usa cartoes do fluxo" ON public.fluxo_cartoes
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

DROP POLICY IF EXISTS "equipe usa responsaveis do fluxo" ON public.fluxo_responsaveis;
CREATE POLICY "equipe usa responsaveis do fluxo" ON public.fluxo_responsaveis
  FOR ALL TO authenticated
  USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

DROP TRIGGER IF EXISTS fluxo_cartoes_updated_at ON public.fluxo_cartoes;
CREATE TRIGGER fluxo_cartoes_updated_at
  BEFORE UPDATE ON public.fluxo_cartoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colunas iniciais, só se o quadro ainda estiver vazio.
INSERT INTO public.fluxo_colunas (nome, ordem)
SELECT v.nome, v.ordem
FROM (VALUES
  ('Clientes', 0),
  ('Social Media', 1),
  ('Designers', 2),
  ('Apresentação', 3),
  ('Revisão Interna', 4),
  ('Revisão do Cliente', 5),
  ('Agendar', 6),
  ('Concluído', 7),
  ('Atrasado', 8),
  ('Tráfego Pago', 9),
  ('Campanha no Ar', 10)
) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.fluxo_colunas);
