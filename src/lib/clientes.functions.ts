import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { permissoesEfetivas, podeEditar, type EquipeRole } from "@/lib/equipe";

const clienteSchema = z.object({
  nome: z.string().trim().min(1).max(160),
  identificador: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
  ad_account_id: z.string().trim().max(60).default(""),
  meta_token: z.string().trim().max(500).default(""),
  investimento_mensal: z.number().nonnegative().default(0),
  meta_faturamento: z.number().nonnegative().default(0),
});

const tokenSchema = z.object({
  clienteId: z.string().uuid(),
  ad_account_id: z.string().trim().min(1).max(60),
  meta_token: z.string().trim().min(1).max(500),
});

const sincronizarSchema = z.object({
  clienteId: z.string().uuid(),
  dias: z.number().int().min(1).max(180).default(30),
});

/**
 * O client tipado é gerado pelo Lovable a partir do schema; enquanto os tipos
 * não são regerados, `clientes_secrets` e as colunas novas não existem para o
 * TypeScript. O cast solta a tipagem apenas dentro destas funções.
 */
async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

/**
 * Erros do PostgREST chegam com code/message/details. Engolir isso numa
 * mensagem genérica torna qualquer diagnóstico impossível, então o texto real
 * vai junto — estas telas só são acessíveis à equipe.
 */
function erroDoBanco(
  error: { code?: string; message?: string; details?: string } | null,
  padrao: string,
): string {
  if (!error) return padrao;
  if (error.code === "23505") return "Já existe um cliente com esse identificador.";
  if (error.code === "42703" || error.code === "42P01") {
    return `A migração da integração com a Meta ainda não foi aplicada no banco (${error.message ?? error.code}).`;
  }
  const detalhe = [error.message, error.details].filter(Boolean).join(" — ");
  return detalhe ? `${padrao} ${detalhe}` : padrao;
}

/** Só integrantes com permissão de edição na aba Clientes podem mexer aqui. */
async function exigirEdicaoDeClientes(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data } = await supabase
    .from("profiles")
    .select("role, equipe_role, permissoes")
    .eq("id", userId)
    .maybeSingle();

  const perfil = data as {
    role?: string;
    equipe_role?: EquipeRole | null;
    permissoes?: unknown;
  } | null;

  if (!perfil || perfil.role !== "agencia") {
    throw new Error("Apenas a equipe pode configurar clientes.");
  }
  const permissoes = permissoesEfetivas(perfil.equipe_role ?? null, perfil.permissoes);
  if (!podeEditar(permissoes, "clientes")) {
    throw new Error("Seu acesso à aba Clientes é somente de visualização.");
  }
}

function periodo(dias: number): { desde: string; ate: string } {
  const ate = new Date();
  const desde = new Date(ate);
  desde.setDate(ate.getDate() - (dias - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { desde: iso(desde), ate: iso(ate) };
}

/**
 * Puxa os insights da Meta e grava um registro por dia. Guardamos todas as
 * ações devolvidas em `acoes`, e só então derivamos leads e conversões — assim
 * trocar o que conta como lead não exige puxar o histórico de novo.
 */
async function sincronizar(
  db: SupabaseClient,
  clienteId: string,
  dias: number,
): Promise<{ dias: number }> {
  const { data: cliente } = await db
    .from("clientes")
    .select("ad_account_id, acao_lead, acao_conversao")
    .eq("id", clienteId)
    .maybeSingle();

  const conta = (cliente as { ad_account_id?: string } | null)?.ad_account_id ?? "";
  if (!conta) throw new Error("Cliente sem conta de anúncio configurada.");

  const { data: segredo } = await db
    .from("clientes_secrets")
    .select("meta_token")
    .eq("cliente_id", clienteId)
    .maybeSingle();

  const token = (segredo as { meta_token?: string } | null)?.meta_token ?? "";
  if (!token) throw new Error("Cliente sem token da Meta configurado.");

  const meta = await import("@/lib/meta.server");
  const { desde, ate } = periodo(dias);

  let insights: Awaited<ReturnType<typeof meta.buscarInsightsDiarios>>;
  let porCampanha: Awaited<ReturnType<typeof meta.buscarInsightsPorCampanha>>;
  let statusCampanhas: Record<string, string>;
  try {
    const janela = { adAccountId: conta, token, desde, ate };
    [insights, porCampanha, statusCampanhas] = await Promise.all([
      meta.buscarInsightsDiarios(janela),
      meta.buscarInsightsPorCampanha(janela),
      meta.buscarStatusCampanhas(conta, token),
    ]);
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : "Falha ao sincronizar.";
    await db
      .from("clientes")
      .update({ erro_sincronizacao: mensagem })
      .eq("id", clienteId);
    throw err;
  }

  const config = cliente as { acao_lead?: string | null; acao_conversao?: string | null } | null;

  const linhas = insights.map((dia) => ({
    cliente_id: clienteId,
    data: dia.data,
    investimento: dia.investimento,
    impressoes: dia.impressoes,
    cliques: dia.cliques,
    acoes: dia.acoes,
    leads: meta.contarAcao(dia.acoes, config?.acao_lead ?? null, meta.ACOES_LEAD_PADRAO),
    conversoes: meta.contarAcao(
      dia.acoes,
      config?.acao_conversao ?? null,
      meta.ACOES_CONVERSAO_PADRAO,
    ),
    atualizado_em: new Date().toISOString(),
  }));

  if (linhas.length > 0) {
    const { error } = await db
      .from("metricas_diarias")
      .upsert(linhas, { onConflict: "cliente_id,data" });
    if (error) throw new Error(erroDoBanco(error, "Métricas obtidas, mas não foi possível gravá-las."));
  }

  const linhasCampanha = porCampanha.map((dia) => ({
    cliente_id: clienteId,
    campanha_id: dia.campanhaId,
    campanha_nome: dia.campanhaNome,
    status: statusCampanhas[dia.campanhaId] ?? "",
    data: dia.data,
    investimento: dia.investimento,
    impressoes: dia.impressoes,
    cliques: dia.cliques,
    acoes: dia.acoes,
    leads: meta.contarAcao(dia.acoes, config?.acao_lead ?? null, meta.ACOES_LEAD_PADRAO),
    conversoes: meta.contarAcao(
      dia.acoes,
      config?.acao_conversao ?? null,
      meta.ACOES_CONVERSAO_PADRAO,
    ),
    atualizado_em: new Date().toISOString(),
  }));

  if (linhasCampanha.length > 0) {
    const { error } = await db
      .from("metricas_campanhas")
      .upsert(linhasCampanha, { onConflict: "cliente_id,campanha_id,data" });
    if (error) {
      throw new Error(erroDoBanco(error, "Não foi possível gravar as métricas por campanha."));
    }
  }

  await db
    .from("clientes")
    .update({ ultima_sincronizacao: new Date().toISOString(), erro_sincronizacao: null })
    .eq("id", clienteId);

  const campanhas = new Set(porCampanha.map((c) => c.campanhaId)).size;
  return { dias: linhas.length, campanhas };
}

/**
 * Cria o cliente e, se token e conta de anúncio vierem preenchidos, valida a
 * credencial na Meta e já faz a primeira carga de métricas.
 */
export const criarClienteComMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => clienteSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirEdicaoDeClientes(context.supabase as unknown as SupabaseClient, context.userId);
    const db = await admin();

    const temMeta = Boolean(data.ad_account_id && data.meta_token);

    // Valida antes de inserir: nada de cliente cadastrado com credencial morta.
    if (temMeta) {
      const meta = await import("@/lib/meta.server");
      await meta.validarCredenciais(data.ad_account_id, data.meta_token);
    }

    const { data: criado, error } = await db
      .from("clientes")
      .insert({
        nome: data.nome,
        identificador: data.identificador.toLowerCase(),
        ad_account_id: data.ad_account_id,
        investimento_mensal: data.investimento_mensal,
        meta_faturamento: data.meta_faturamento,
        token_atualizado_em: temMeta ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !criado) {
      throw new Error(erroDoBanco(error, "Não foi possível criar o cliente."));
    }

    const clienteId = (criado as { id: string }).id;

    if (!temMeta) return { id: clienteId, sincronizado: 0 };

    const { error: erroSegredo } = await db
      .from("clientes_secrets")
      .upsert(
        { cliente_id: clienteId, meta_token: data.meta_token, updated_at: new Date().toISOString() },
        { onConflict: "cliente_id" },
      );
    if (erroSegredo) {
      throw new Error(erroDoBanco(erroSegredo, "Cliente criado, mas o token não pôde ser guardado."));
    }

    // O cliente já existe; uma falha aqui não deve desfazer o cadastro. Ela
    // fica registrada em erro_sincronizacao e o botão Sincronizar resolve.
    try {
      const { dias } = await sincronizar(db, clienteId, 30);
      return { id: clienteId, sincronizado: dias };
    } catch {
      return { id: clienteId, sincronizado: 0 };
    }
  });

/** Substitui o token da Meta de um cliente já cadastrado. */
export const salvarTokenMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirEdicaoDeClientes(context.supabase as unknown as SupabaseClient, context.userId);
    const db = await admin();

    const meta = await import("@/lib/meta.server");
    const conta = await meta.validarCredenciais(data.ad_account_id, data.meta_token);

    const { error } = await db.from("clientes_secrets").upsert(
      { cliente_id: data.clienteId, meta_token: data.meta_token, updated_at: new Date().toISOString() },
      { onConflict: "cliente_id" },
    );
    if (error) throw new Error(erroDoBanco(error, "Não foi possível guardar o token."));

    await db
      .from("clientes")
      .update({
        ad_account_id: data.ad_account_id,
        token_atualizado_em: new Date().toISOString(),
        erro_sincronizacao: null,
      })
      .eq("id", data.clienteId);

    return { conta: conta.nome };
  });

/** Puxa novamente as métricas de um cliente já configurado. */
export const sincronizarMetricasMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => sincronizarSchema.parse(data))
  .handler(async ({ data, context }) => {
    await exigirEdicaoDeClientes(context.supabase as unknown as SupabaseClient, context.userId);
    const db = await admin();
    return await sincronizar(db, data.clienteId, data.dias);
  });
