/**
 * Períodos e agregação do dashboard de métricas.
 *
 * As linhas vêm de `metricas_campanhas` — um registro por campanha por dia.
 * Somar todas as campanhas dá o total da conta, então o dashboard trabalha
 * sempre sobre a mesma fonte, com ou sem filtro.
 */

export type PeriodoId = "hoje" | "7d" | "30d" | "mes";

export const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Mês atual" },
];

export type LinhaCampanha = {
  campanha_id: string;
  campanha_nome: string;
  status: string;
  data: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  conversoes: number;
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function diasDoPeriodo(periodo: PeriodoId): number {
  if (periodo === "hoje") return 1;
  if (periodo === "7d") return 7;
  if (periodo === "30d") return 30;
  const hoje = new Date();
  return hoje.getDate();
}

/** Janela do período selecionado, inclusiva nas duas pontas. */
export function intervalo(periodo: PeriodoId): { desde: string; ate: string } {
  const hoje = new Date();
  const desde = new Date(hoje);
  desde.setDate(hoje.getDate() - (diasDoPeriodo(periodo) - 1));
  return { desde: iso(desde), ate: iso(hoje) };
}

/** Janela de mesmo tamanho imediatamente anterior, para a variação percentual. */
export function intervaloAnterior(periodo: PeriodoId): { desde: string; ate: string } {
  const dias = diasDoPeriodo(periodo);
  const hoje = new Date();
  const ate = new Date(hoje);
  ate.setDate(hoje.getDate() - dias);
  const desde = new Date(ate);
  desde.setDate(ate.getDate() - (dias - 1));
  return { desde: iso(desde), ate: iso(ate) };
}

export type Totais = {
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  conversoes: number;
  ctr: number;
  cpc: number;
  cpl: number;
};

export function totais(linhas: LinhaCampanha[]): Totais {
  const t = linhas.reduce(
    (acc, d) => ({
      investimento: acc.investimento + d.investimento,
      impressoes: acc.impressoes + d.impressoes,
      cliques: acc.cliques + d.cliques,
      leads: acc.leads + d.leads,
      conversoes: acc.conversoes + d.conversoes,
    }),
    { investimento: 0, impressoes: 0, cliques: 0, leads: 0, conversoes: 0 },
  );
  return {
    ...t,
    ctr: t.impressoes ? (t.cliques / t.impressoes) * 100 : 0,
    cpc: t.cliques ? t.investimento / t.cliques : 0,
    cpl: t.leads ? t.investimento / t.leads : 0,
  };
}

export function variacao(atual: number, anterior: number): number {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

export type Campanha = { id: string; nome: string; status: string };

/** Campanhas distintas presentes no período, para montar o filtro. */
export function campanhasDe(linhas: LinhaCampanha[]): Campanha[] {
  const mapa = new Map<string, Campanha>();
  for (const linha of linhas) {
    if (!mapa.has(linha.campanha_id)) {
      mapa.set(linha.campanha_id, {
        id: linha.campanha_id,
        nome: linha.campanha_nome || linha.campanha_id,
        status: linha.status,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

/** Série diária somada, pronta para o gráfico. */
export function porDia(linhas: LinhaCampanha[]): { data: string; leads: number; investimento: number }[] {
  const mapa = new Map<string, { leads: number; investimento: number }>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.data) ?? { leads: 0, investimento: 0 };
    atual.leads += linha.leads;
    atual.investimento += linha.investimento;
    mapa.set(linha.data, atual);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, v]) => ({ data, leads: v.leads, investimento: Math.round(v.investimento) }));
}

/** Totais por campanha, para a tabela. */
export function porCampanha(
  linhas: LinhaCampanha[],
): { id: string; nome: string; status: string; investimento: number; leads: number }[] {
  const mapa = new Map<string, { nome: string; status: string; investimento: number; leads: number }>();
  for (const linha of linhas) {
    const atual = mapa.get(linha.campanha_id) ?? {
      nome: linha.campanha_nome || linha.campanha_id,
      status: linha.status,
      investimento: 0,
      leads: 0,
    };
    atual.investimento += linha.investimento;
    atual.leads += linha.leads;
    mapa.set(linha.campanha_id, atual);
  }
  return [...mapa.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.investimento - a.investimento);
}
