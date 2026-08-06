import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const NIVEIS_VALIDOS = [
  "super_admin",
  "admin",
  "gestor_trafego",
  "social_media",
  "gerente_projeto",
  "designer",
  "editor_video",
] as const;

const criarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  senha: z.string().min(8).max(72),
  equipe_role: z.enum(NIVEIS_VALIDOS),
  permissoes: z.record(z.string(), z.enum(["nenhum", "ver", "editar"])).default({}),
});

const senhaSchema = z.object({
  userId: z.string().uuid(),
  senha: z.string().min(8).max(72),
});

/** Traduz os erros do Supabase Auth para mensagens em português. */
function mensagemDeCriacao(error: { message?: string; code?: string } | null): string {
  const codigo = error?.code ?? "";
  const texto = error?.message ?? "";
  if (codigo === "email_exists" || /already (been )?registered|already exists/i.test(texto)) {
    return "Já existe uma conta com este e-mail.";
  }
  if (codigo === "weak_password") {
    return "Senha muito fraca. Use ao menos 8 caracteres.";
  }
  if (codigo === "validation_failed" || /invalid email/i.test(texto)) {
    return "E-mail inválido.";
  }
  return "Não foi possível criar o acesso.";
}

/** Confirma que quem chama é admin/super admin e devolve o nível dele. */
async function nivelDoChamador(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
    };
  };
}, userId: string) {
  const { data } = await supabase.from("profiles").select("equipe_role").eq("id", userId).maybeSingle();
  const nivel = (data as { equipe_role: string | null } | null)?.equipe_role ?? null;
  if (nivel !== "super_admin" && nivel !== "admin") {
    throw new Error("Apenas admin e super admin podem gerenciar credenciais da equipe.");
  }
  return nivel;
}

export const criarAcessoEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => criarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const nivelChamador = await nivelDoChamador(context.supabase as never, context.userId);
    if (nivelChamador === "admin" && (data.equipe_role === "super_admin" || data.equipe_role === "admin")) {
      throw new Error("Admin pode conceder apenas níveis de admin para baixo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !criado.user) {
      throw new Error(mensagemDeCriacao(error));
    }

    // `.select()` é obrigatório: sem ele um update que não atinge nenhuma linha
    // devolve error = null e o acesso ficaria criado no Auth sem perfil válido.
    const { data: perfil, error: erroPerfil } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        email: data.email,
        role: "agencia",
        equipe_role: data.equipe_role,
        permissoes: data.permissoes,
        cliente_id: null,
      })
      .eq("id", criado.user.id)
      .select("id")
      .maybeSingle();

    if (erroPerfil || !perfil) {
      // Desfaz o usuário recém-criado para não deixar um acesso órfão no Auth.
      await supabaseAdmin.auth.admin.deleteUser(criado.user.id);
      throw new Error("Não foi possível salvar o perfil do integrante. Nenhum acesso foi criado.");
    }

    return { id: criado.user.id };
  });

export const definirSenhaEquipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => senhaSchema.parse(data))
  .handler(async ({ data, context }) => {
    const nivelChamador = await nivelDoChamador(context.supabase as never, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: alvo } = await supabaseAdmin
      .from("profiles")
      .select("equipe_role")
      .eq("id", data.userId)
      .maybeSingle();
    const nivelAlvo = (alvo as { equipe_role: string | null } | null)?.equipe_role ?? null;
    if (nivelChamador === "admin" && (nivelAlvo === "super_admin" || nivelAlvo === "admin")) {
      throw new Error("Apenas o super admin pode alterar senhas de admin.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.senha,
    });
    if (error) throw new Error("Não foi possível atualizar a senha.");
    return { ok: true };
  });
