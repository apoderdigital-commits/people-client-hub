REVOKE EXECUTE ON FUNCTION public.is_equipe(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_cliente_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_equipe(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_cliente_id() TO authenticated;