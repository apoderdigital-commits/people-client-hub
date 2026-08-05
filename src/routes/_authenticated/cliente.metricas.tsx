import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppHeader } from "@/components/AppHeader";
import { KpiCard } from "@/components/KpiCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { VisaoClienteBanner, VisaoClienteGate } from "@/components/VisaoCliente";
import {
  CAMPANHAS,
  PERIODOS,
  serieAnterior,
  serieDoPeriodo,
  type MetricaDiaria,
  type PeriodoId,
} from "@/mocks/metrics";

export const Route = createFileRoute("/_authenticated/cliente/metricas")({
  head: () => ({
    meta: [
      { title: "Dashboard de Métricas — people" },
      {
        name: "description",
        content:
          "Investimento, impressões, cliques, CTR, CPC, leads, CPL e conversões das suas campanhas.",
      },
      { property: "og:title", content: "Dashboard de Métricas — people" },
      {
        property: "og:description",
        content: "Acompanhe em tempo real o desempenho do seu investimento em mídia.",
      },
    ],
  }),
  component: MetricasPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const num = new Intl.NumberFormat("pt-BR");

function totais(serie: MetricaDiaria[]) {
  const t = serie.reduce(
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

function variacao(atual: number, anterior: number) {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

function MetricasPage() {
  const [periodo, setPeriodo] = useState<PeriodoId>("30d");

  const { atual, anterior, grafico } = useMemo(() => {
    const serie = serieDoPeriodo(periodo);
    return {
      atual: totais(serie),
      anterior: totais(serieAnterior(periodo)),
      grafico: serie.map((d) => ({
        data: new Date(`${d.data}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        leads: d.leads,
        investimento: Math.round(d.investimento),
      })),
    };
  }, [periodo]);

  return (
    <ProtectedRoute role="cliente">
      {(perfil) => (
        <VisaoClienteGate perfil={perfil}>
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <VisaoClienteBanner perfil={perfil} />
          <main className="mx-auto w-full max-w-6xl px-4 py-8">
            <Link
              to="/cliente"
              className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted transition-colors hover:text-brand"
            >
              <ChevronLeft className="size-4" />
              Voltar
            </Link>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:flex sm:justify-between">
              <h1 className="text-2xl font-bold text-ink sm:text-3xl">Dashboard de Métricas</h1>
              <div className="flex flex-wrap gap-1.5">
                {PERIODOS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriodo(p.id)}
                    className={
                      periodo === p.id
                        ? "rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                        : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard
                rotulo="Investimento"
                valor={brl.format(atual.investimento)}
                variacao={variacao(atual.investimento, anterior.investimento)}
              />
              <KpiCard
                rotulo="Impressões"
                valor={num.format(atual.impressoes)}
                variacao={variacao(atual.impressoes, anterior.impressoes)}
              />
              <KpiCard
                rotulo="Cliques"
                valor={num.format(atual.cliques)}
                variacao={variacao(atual.cliques, anterior.cliques)}
              />
              <KpiCard
                rotulo="CTR"
                valor={`${atual.ctr.toFixed(2)}%`}
                variacao={variacao(atual.ctr, anterior.ctr)}
              />
              <KpiCard
                rotulo="CPC"
                valor={brl.format(atual.cpc)}
                variacao={variacao(atual.cpc, anterior.cpc)}
                inverso
              />
              <KpiCard
                rotulo="Leads"
                valor={num.format(atual.leads)}
                variacao={variacao(atual.leads, anterior.leads)}
              />
              <KpiCard
                rotulo="CPL"
                valor={brl.format(atual.cpl)}
                variacao={variacao(atual.cpl, anterior.cpl)}
                inverso
              />
              <KpiCard
                rotulo="Conversões"
                valor={num.format(atual.conversoes)}
                variacao={variacao(atual.conversoes, anterior.conversoes)}
              />
            </div>

            <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">Leads x Investimento</h2>
              <p className="text-sm text-ink-muted">Evolução diária no período selecionado.</p>
              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={grafico} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                      stroke="var(--color-border)"
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                      stroke="var(--color-border)"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12, fill: "var(--color-ink-muted)" }}
                      stroke="var(--color-border)"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        color: "var(--color-ink)",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="var(--color-brand)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="investimento"
                      name="Investimento (R$)"
                      stroke="var(--color-card-violet)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">Campanhas</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-ink-muted">
                      <th className="pb-2 font-medium">Nome</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Investimento</th>
                      <th className="pb-2 font-medium">Leads</th>
                      <th className="pb-2 font-medium">CPL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMPANHAS.map((c) => (
                      <tr key={c.nome} className="border-t border-border">
                        <td className="py-3 font-medium text-ink">{c.nome}</td>
                        <td className="py-3">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-ink-muted">
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 text-ink">{brl.format(c.investimento)}</td>
                        <td className="py-3 text-ink">{num.format(c.leads)}</td>
                        <td className="py-3 text-ink">
                          {brl.format(c.leads ? c.investimento / c.leads : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
        </VisaoClienteGate>
      )}
    </ProtectedRoute>
  );
}
