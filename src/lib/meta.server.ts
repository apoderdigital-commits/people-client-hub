/**
 * Cliente da Graph API da Meta (Marketing API).
 *
 * Este módulo só pode ser importado dentro de handlers de server function, via
 * `await import(...)`: o token de anúncios do cliente nunca deve chegar ao
 * navegador. Arquivos `*.functions.ts` e de rota vão para o bundle do cliente.
 */

const VERSAO_API = "v21.0";
const BASE = `https://graph.facebook.com/${VERSAO_API}`;
const MAX_PAGINAS = 25;

export type InsightDiario = {
  data: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  /** Todas as ações devolvidas pela Meta, por action_type. */
  acoes: Record<string, number>;
};

type LinhaInsight = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type?: string; value?: string }[];
};

type ErroMeta = { message?: string; type?: string; code?: number; error_subcode?: number };

type Resposta<T> = { data?: T[]; paging?: { next?: string }; error?: ErroMeta };

/** A Meta aceita a conta com e sem o prefixo; a API exige o prefixo. */
export function normalizarConta(id: string): string {
  const limpo = id.trim();
  return limpo.startsWith("act_") ? limpo : `act_${limpo}`;
}

function numero(valor: string | undefined): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

/** Mensagens da Meta chegam em inglês e sem contexto; traduzimos as comuns. */
function traduzirErro(erro: ErroMeta): string {
  const codigo = erro.code;
  if (codigo === 190) {
    return "Token da Meta inválido ou expirado. Gere um novo token e salve novamente.";
  }
  if (codigo === 200 || codigo === 10) {
    return "O token não tem permissão para ler esta conta de anúncio (é necessário o escopo ads_read).";
  }
  if (codigo === 100) {
    return "Conta de anúncio não encontrada. Confira o ID (formato act_123456789).";
  }
  if (codigo === 17 || codigo === 4 || codigo === 613) {
    return "Limite de requisições da Meta atingido. Tente novamente em alguns minutos.";
  }
  if (codigo === 803) {
    return "Conta de anúncio inacessível com este token.";
  }
  return erro.message
    ? `Erro da Meta: ${erro.message}`
    : "Não foi possível falar com a Meta.";
}

async function pedir<T>(url: string): Promise<Resposta<T>> {
  let resposta: Response;
  try {
    resposta = await fetch(url);
  } catch {
    throw new Error("Não foi possível alcançar a Meta. Verifique a conexão.");
  }

  let corpo: Resposta<T>;
  try {
    corpo = (await resposta.json()) as Resposta<T>;
  } catch {
    throw new Error("A Meta devolveu uma resposta inesperada.");
  }

  if (corpo.error) throw new Error(traduzirErro(corpo.error));
  if (!resposta.ok) throw new Error("A Meta recusou a requisição.");
  return corpo;
}

/**
 * Confirma que o par token + conta de anúncio funciona, devolvendo o nome da
 * conta. Serve para validar a credencial no momento do cadastro.
 */
export async function validarCredenciais(
  adAccountId: string,
  token: string,
): Promise<{ nome: string; moeda: string }> {
  const conta = normalizarConta(adAccountId);
  const url = new URL(`${BASE}/${conta}`);
  url.searchParams.set("fields", "name,currency,account_status");
  url.searchParams.set("access_token", token);

  const corpo = (await pedir<never>(url.toString())) as unknown as {
    name?: string;
    currency?: string;
  };
  return { nome: corpo.name ?? conta, moeda: corpo.currency ?? "BRL" };
}

/**
 * Insights diários da conta, um registro por dia. `time_increment=1` faz a
 * Meta quebrar o período por dia em vez de somar tudo num único total.
 */
export async function buscarInsightsDiarios(opts: {
  adAccountId: string;
  token: string;
  desde: string;
  ate: string;
}): Promise<InsightDiario[]> {
  const conta = normalizarConta(opts.adAccountId);
  const url = new URL(`${BASE}/${conta}/insights`);
  url.searchParams.set("level", "account");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", "spend,impressions,clicks,actions");
  url.searchParams.set(
    "time_range",
    JSON.stringify({ since: opts.desde, until: opts.ate }),
  );
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", opts.token);

  const linhas: LinhaInsight[] = [];
  let proxima: string | undefined = url.toString();

  for (let pagina = 0; proxima && pagina < MAX_PAGINAS; pagina++) {
    const corpo: Resposta<LinhaInsight> = await pedir<LinhaInsight>(proxima);
    linhas.push(...(corpo.data ?? []));
    proxima = corpo.paging?.next;
  }

  return linhas
    .filter((l) => Boolean(l.date_start))
    .map((linha) => {
      const acoes: Record<string, number> = {};
      for (const acao of linha.actions ?? []) {
        if (acao.action_type) acoes[acao.action_type] = numero(acao.value);
      }
      return {
        data: linha.date_start as string,
        investimento: numero(linha.spend),
        impressoes: numero(linha.impressions),
        cliques: numero(linha.clicks),
        acoes,
      };
    });
}

/**
 * Tipos de ação que costumam representar um lead, em ordem de preferência.
 * Usados apenas quando o cliente ainda não tem `acao_lead` configurada — a
 * lista completa fica gravada em `metricas_diarias.acoes`, então trocar a
 * escolha depois não exige puxar o histórico de novo.
 */
export const ACOES_LEAD_PADRAO = [
  "onsite_conversion.messaging_conversation_started_7d",
  "offsite_conversion.fb_pixel_lead",
  "leadgen_grouped",
  "lead",
] as const;

export const ACOES_CONVERSAO_PADRAO = [
  "offsite_conversion.fb_pixel_purchase",
  "purchase",
  "omni_purchase",
] as const;

/** Resolve quantos leads houve num dia, respeitando a configuração do cliente. */
export function contarAcao(
  acoes: Record<string, number>,
  configurada: string | null,
  padroes: readonly string[],
): number {
  if (configurada) return acoes[configurada] ?? 0;
  for (const tipo of padroes) {
    if (acoes[tipo] !== undefined) return acoes[tipo];
  }
  return 0;
}
