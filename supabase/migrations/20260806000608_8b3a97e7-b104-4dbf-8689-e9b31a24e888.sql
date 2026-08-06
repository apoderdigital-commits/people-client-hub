-- Corrige o vínculo entre perfis e clientes.
--
-- O handle_new_user original gravava cliente_id = gen_random_uuid() para todo
-- usuário novo, gerando um vínculo para um cliente que nunca existiu. Como não
-- havia foreign key, o banco aceitava o valor e o cliente via o dashboard vazio
-- sem nenhum erro. O vínculo passa a ser explícito.
--
-- Script idempotente: já foi aplicado manualmente no ambiente atual.

-- 1. O trigger não inventa mais cliente_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Limpa vínculos que não apontam para nenhum cliente real.
UPDATE public.profiles p
SET cliente_id = NULL
WHERE p.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.clientes c WHERE c.id = p.cliente_id);

-- 3. Conta de equipe nunca carrega cliente_id.
UPDATE public.profiles SET cliente_id = NULL WHERE role = 'agencia';

-- 4. Impede que o problema volte.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cliente_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cliente_id_fkey
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;
