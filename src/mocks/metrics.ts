/**
 * Dados mockados de métricas. A forma dos registros diários espelha a tabela
 * `metricas_diarias` (cliente_id, data, investimento, impressoes, cliques,
 * leads, conversoes), para que a troca por dados reais seja direta.
 */

export type MetricaDiaria = {
  cliente_id: string;
  data: string;
  investimento: number;
  impressoes: number;
  cliques: number;
  leads: number;
  conversoes: number;
};

export type PeriodoId = "hoje" | "7d" | "30d" | "mes" | "custom";

export const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: "hoje", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "mes", label: "Mês atual" },
  { id: "custom", label: "Personalizado" },
];

const CLIENTE_DEMO = "00000000-0000-0000-0000-000000000001";

function pseudoAleatorio(semente: number) {
  const x = Math.sin(semente * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function gerarSerie(dias: number): MetricaDiaria[] {
  const hoje = new Date();
  return Array.from({ length: dias }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - (dias - 1 - i));
    const r = pseudoAleatorio(i + 1);
    const r2 = pseudoAleatorio(i + 42);
    const investimento = Math.round((320 + r * 260) * 100) / 100;
    const impressoes = Math.round(18000 + r2 * 14000);
    const cliques = Math.round(impressoes * (0.021 + r * 0.014));
    const leads = Math.round(cliques * (0.07 + r2 * 0.05));
    const conversoes = Math.round(leads * (0.18 + r * 0.12));
    return {
      cliente_id: CLIENTE_DEMO,
      data: d.toISOString().slice(0, 10),
      investimento,
      impressoes,
      cliques,
      leads,
      conversoes,
    };
  });
}

export const SERIE_DIARIA: MetricaDiaria[] = gerarSerie(60);

export function serieDoPeriodo(periodo: PeriodoId): MetricaDiaria[] {
  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : periodo === "mes" ? 30 : 30;
  return SERIE_DIARIA.slice(-dias);
}

export function serieAnterior(periodo: PeriodoId): MetricaDiaria[] {
  const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
  return SERIE_DIARIA.slice(-dias * 2, -dias);
}

export type Campanha = {
  nome: string;
  status: "Ativa" | "Pausada" | "Em revisão";
  investimento: number;
  leads: number;
};

export const CAMPANHAS: Campanha[] = [
  { nome: "Institucional — Meta Ads", status: "Ativa", investimento: 6420.5, leads: 214 },
  { nome: "Google Search — Marca", status: "Ativa", investimento: 4180.9, leads: 176 },
  { nome: "Remarketing — Display", status: "Pausada", investimento: 1290.4, leads: 38 },
  { nome: "Lançamento Outono", status: "Ativa", investimento: 3875.0, leads: 129 },
  { nome: "Prospecção — LinkedIn", status: "Em revisão", investimento: 2140.25, leads: 47 },
];
