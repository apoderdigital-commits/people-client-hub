-- Cartão do Fluxo People no formato Trello: campos personalizados, etiquetas,
-- checklist, comentários e anexos.
--
-- Mesmo padrão de autorização do resto do quadro: o RLS libera a equipe como um
-- todo e a permissão fina da aba "fluxo" é aplicada na interface.

ALTER TABLE public.fluxo_cartoes
  ADD COLUMN IF NOT EXISTS descricao     text,
  ADD COLUMN IF NOT EXISTS entrega_texto date,
  ADD COLUMN IF NOT EXISTS entrega_arte  date,
  ADD COLUMN IF NOT EXISTS agendamento   date,
  ADD COLUMN IF NOT EXISTS publicacao    date,
  ADD COLUMN IF NOT EXISTS prioridade    text,
  ADD COLUMN IF NOT EXISTS tipo_post     text;

-- --- etiquetas (reutilizáveis no quadro inteiro) ---

CREATE TABLE IF NOT EXISTS public.fluxo_etiquetas (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor  text NOT NULL DEFAULT 'amber'
);

CREATE TABLE IF NOT EXISTS public.fluxo_cartao_etiquetas (
  cartao_id   uuid NOT NULL REFERENCES public.fluxo_cartoes(id)   ON DELETE CASCADE,
  etiqueta_id uuid NOT NULL REFERENCES public.fluxo_etiquetas(id) ON DELETE CASCADE,
  PRIMARY KEY (cartao_id, etiqueta_id)
);

-- --- checklist ---

CREATE TABLE IF NOT EXISTS public.fluxo_checklist (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id uuid NOT NULL REFERENCES public.fluxo_cartoes(id) ON DELETE CASCADE,
  texto     text NOT NULL,
  feito     boolean NOT NULL DEFAULT false,
  ordem     integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS fluxo_checklist_cartao_idx
  ON public.fluxo_checklist (cartao_id, ordem);

-- --- comentários ---

CREATE TABLE IF NOT EXISTS public.fluxo_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id  uuid NOT NULL REFERENCES public.fluxo_cartoes(id) ON DELETE CASCADE,
  autor_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  texto      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fluxo_comentarios_cartao_idx
  ON public.fluxo_comentarios (cartao_id, created_at DESC);

-- --- anexos (metadados; o arquivo vive no Storage) ---

CREATE TABLE IF NOT EXISTS public.fluxo_anexos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cartao_id   uuid NOT NULL REFERENCES public.fluxo_cartoes(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  caminho     text NOT NULL,
  tamanho     bigint NOT NULL DEFAULT 0,
  enviado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fluxo_anexos_cartao_idx
  ON public.fluxo_anexos (cartao_id, created_at DESC);

-- --- grants e RLS ---

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fluxo_etiquetas', 'fluxo_cartao_etiquetas', 'fluxo_checklist',
    'fluxo_comentarios', 'fluxo_anexos'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "equipe usa %s" ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY "equipe usa %s" ON public.%I FOR ALL TO authenticated
         USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()))',
      t, t
    );
  END LOOP;
END $$;

-- Comentário só pode ser criado em nome de quem está logado, e apagado apenas
-- pelo próprio autor. A policy genérica acima seria permissiva demais aqui.
DROP POLICY IF EXISTS "equipe usa fluxo_comentarios" ON public.fluxo_comentarios;

CREATE POLICY "equipe le comentarios" ON public.fluxo_comentarios
  FOR SELECT TO authenticated USING (public.is_equipe(auth.uid()));

CREATE POLICY "autor cria comentario" ON public.fluxo_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (public.is_equipe(auth.uid()) AND autor_id = auth.uid());

CREATE POLICY "autor edita comentario" ON public.fluxo_comentarios
  FOR UPDATE TO authenticated
  USING (autor_id = auth.uid()) WITH CHECK (autor_id = auth.uid());

CREATE POLICY "autor remove comentario" ON public.fluxo_comentarios
  FOR DELETE TO authenticated USING (autor_id = auth.uid());

-- --- Storage dos anexos ---

INSERT INTO storage.buckets (id, name, public)
VALUES ('fluxo-anexos', 'fluxo-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "equipe le anexos do fluxo"    ON storage.objects;
DROP POLICY IF EXISTS "equipe envia anexos do fluxo" ON storage.objects;
DROP POLICY IF EXISTS "equipe apaga anexos do fluxo" ON storage.objects;

CREATE POLICY "equipe le anexos do fluxo" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'fluxo-anexos' AND public.is_equipe(auth.uid()));

CREATE POLICY "equipe envia anexos do fluxo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fluxo-anexos' AND public.is_equipe(auth.uid()));

CREATE POLICY "equipe apaga anexos do fluxo" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'fluxo-anexos' AND public.is_equipe(auth.uid()));

-- Etiquetas iniciais, só se ainda não houver nenhuma.
INSERT INTO public.fluxo_etiquetas (nome, cor)
SELECT v.nome, v.cor
FROM (VALUES
  ('Urgente', 'pink'),
  ('Social Media', 'violet'),
  ('Design', 'indigo'),
  ('Tráfego', 'teal'),
  ('Aprovado', 'amber')
) AS v(nome, cor)
WHERE NOT EXISTS (SELECT 1 FROM public.fluxo_etiquetas);
