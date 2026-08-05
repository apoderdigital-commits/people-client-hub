import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { EquipeRole } from "@/lib/equipe";

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  role: "cliente" | "agencia";
  equipe_role: EquipeRole | null;
  permissoes: unknown;
  cliente_id: string | null;
  avatar_url: string | null;
};



export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarPerfil(userId: string) {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email, role, equipe_role, permissoes, cliente_id, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (ativo) setPerfil((data as Perfil | null) ?? null);
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSession(data.session ?? null);
      if (data.session?.user) await carregarPerfil(data.session.user.id);
      if (ativo) setCarregando(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(next ?? null);
      if (next?.user) void carregarPerfil(next.user.id);
      else setPerfil(null);
    });

    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, perfil, carregando };
}
