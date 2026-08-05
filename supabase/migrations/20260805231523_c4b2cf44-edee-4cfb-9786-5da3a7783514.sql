-- Níveis de acesso do time people
CREATE TYPE public.equipe_role AS ENUM ('super_admin', 'gestor', 'analista');

ALTER TABLE public.profiles ADD COLUMN equipe_role public.equipe_role;

CREATE OR REPLACE FUNCTION public.is_equipe(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'agencia');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND equipe_role = 'super_admin');
$$;

REVOKE EXECUTE ON FUNCTION public.is_equipe(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;

UPDATE public.profiles
SET role = 'agencia', equipe_role = 'super_admin'
WHERE email = 'tthiagocavalcant@gmail.com';

-- Super admin também pode gerenciar perfis do time
CREATE POLICY "super admin update profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Cadastro de clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  identificador text NOT NULL UNIQUE,
  ad_account_id text NOT NULL DEFAULT '',
  meta_token text NOT NULL DEFAULT '',
  investimento_mensal numeric NOT NULL DEFAULT 0,
  meta_faturamento numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipe ve clientes" ON public.clientes
FOR SELECT TO authenticated USING (public.is_equipe(auth.uid()));

CREATE POLICY "equipe cria clientes" ON public.clientes
FOR INSERT TO authenticated WITH CHECK (public.is_equipe(auth.uid()));

CREATE POLICY "equipe edita clientes" ON public.clientes
FOR UPDATE TO authenticated
USING (public.is_equipe(auth.uid())) WITH CHECK (public.is_equipe(auth.uid()));

CREATE POLICY "super admin remove clientes" ON public.clientes
FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();