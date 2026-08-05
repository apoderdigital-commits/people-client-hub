CREATE TYPE public.app_role AS ENUM ('cliente', 'agencia');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'cliente',
  cliente_id UUID,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_cliente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT cliente_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "agencia select all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'agencia'));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.metricas_diarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL,
  data DATE NOT NULL,
  investimento NUMERIC NOT NULL DEFAULT 0,
  impressoes INTEGER NOT NULL DEFAULT 0,
  cliques INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  conversoes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, data)
);

GRANT SELECT ON public.metricas_diarias TO authenticated;
GRANT ALL ON public.metricas_diarias TO service_role;
ALTER TABLE public.metricas_diarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cliente ve suas metricas" ON public.metricas_diarias FOR SELECT TO authenticated
  USING (cliente_id = public.current_cliente_id());
CREATE POLICY "agencia ve todas metricas" ON public.metricas_diarias FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'agencia'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, cliente_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, ''),
    gen_random_uuid()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();