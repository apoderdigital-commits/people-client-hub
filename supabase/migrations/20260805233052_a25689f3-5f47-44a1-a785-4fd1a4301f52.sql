ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'gestor_trafego';
ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'social_media';
ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'gerente_projeto';
ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'designer';
ALTER TYPE public.equipe_role ADD VALUE IF NOT EXISTS 'editor_video';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS permissoes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.is_equipe_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND role = 'agencia'
      AND equipe_role::text IN ('super_admin', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_equipe_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_equipe_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "agencia update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "super admin update profiles" ON public.profiles;

CREATE POLICY "equipe admin update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_equipe_admin(auth.uid()))
WITH CHECK (public.is_equipe_admin(auth.uid()));