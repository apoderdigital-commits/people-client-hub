import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronLeft, Loader2 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { KpiCard } from "@/components/KpiCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { VisaoClienteBanner, VisaoClienteGate } from "@/components/VisaoCliente";
import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/hooks/use-auth";
import { useClienteSelecionado } from "@/lib/visao-cliente";
import {
  campanhasDe,
  intervalo,
  intervaloAnterior,
  porCampanha,
  porDia,
  totais,
  variacao,
  PERIODOS,
  type Campanha,
  type LinhaCampanha,
  type PeriodoId,
} from "@/lib/metricas";

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

const COLUNAS =
  "campanha_id, campanha_nome, status, data, investimento, impressoes, cliques, leads, conversoes";

/** types.ts é gerado pelo Lovable e ainda não conhece `metricas_campanhas`. */
const db = supabase as unknown as SupabaseClient;

function diaCurto(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function MetricasPage() {
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
              <Painel perfil={perfil} />
            </main>
          </div>
        </VisaoClienteGate>
      )}
    </ProtectedRoute>
  );
}

function Painel({ perfil }: { perfil: Perfil }) {
  const { cliente: selecionado, pronto } = useClienteSelecionado();
  const [periodo, setPeriodo] = useState<PeriodoId>("30d");
  const [linhas, setLinhas] = useState<LinhaCampanha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  /** null = todas as campanhas; caso contrário, os ids escolhidos. */
  const [selecionadas, setSelecionadas] = useState<string[] | null>(null);

  // A agência vê a empresa escolhida em "Selecionar Cliente"; o cliente vê a dele.
  const clienteId = perfil.role === "agencia" ? (selecionado?.cliente_id ?? null) : perfil.cliente_id;

  useEffect(() => {
    if (!pronto) return;
    if (!clienteId) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    setCarregando(true);
    const janela = intervalo(periodo);
    const anterior = intervaloAnterior(periodo);

    db
      .from("metricas_campanhas")
      .select(COLUNAS)
      .eq("cliente_id", clienteId)
      .gte("data", anterior.desde)
      .lte("data", janela.ate)
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        else {
          setErro(null);
          setLinhas((data as LinhaCampanha[]) ?? []);
        }
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [clienteId, periodo, pronto]);

  const { campanhas, atual, anterior, grafico, tabela } = useMemo(() => {
    const janela = intervalo(periodo);
    const daJanela = linhas.filter((l) => l.data >= janela.desde && l.data <= janela.ate);
    const daAnterior = linhas.filter((l) => l.data < janela.desde);

    const lista = campanhasDe(daJanela);
    const filtrar = (ls: LinhaCampanha[]) =>
      selecionadas === null ? ls : ls.filter((l) => selecionadas.includes(l.campanha_id));

    const filtradas = filtrar(daJanela);
    return {
      campanhas: lista,
      atual: totais(filtradas),
      anterior: totais(filtrar(daAnterior)),
      grafico: porDia(filtradas).map((d) => ({ ...d, data: diaCurto(d.data) })),
      tabela: porCampanha(filtradas),
    };
  }, [linhas, periodo, selecionadas]);

  if (!clienteId) {
    return (
      <p className="mt-8 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-ink-muted shadow-card">
        Sua conta ainda não está vinculada a um cliente. Fale com a agência.
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-end gap-4 sm:flex sm:justify-between">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Dashboard de Métricas</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <FiltroCampanhas
            campanhas={campanhas}
            selecionadas={selecionadas}
            onChange={setSelecionadas}
          />
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

      {erro ? <p className="mt-4 text-sm text-destructive">{erro}</p> : null}

      {carregando ? (
        <div className="mt-10 grid place-items-center py-10">
          <Loader2 className="size-5 animate-spin text-brand" />
        </div>
      ) : linhas.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm text-ink-muted">
            Nenhuma métrica importada ainda para este período.
          </p>
          {perfil.role === "agencia" ? (
            <p className="mt-2 text-sm text-ink-muted">
              Use{" "}
              <Link to="/agencia/clientes" className="font-semibold text-brand hover:underline">
                Sincronizar em Configurar Clientes
              </Link>{" "}
              para puxar os dados da Meta.
            </p>
          ) : null}
        </div>
      ) : (
        <>
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
                  {tabela.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-3 font-medium text-ink">{c.nome}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-ink-muted">
                          {c.status || "—"}
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
        </>
      )}
    </>
  );
}

/** Menu de campanhas: nenhuma seleção explícita significa "todas". */
function FiltroCampanhas({
  campanhas,
  selecionadas,
  onChange,
}: {
  campanhas: Campanha[];
  selecionadas: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const rotulo = (() => {
    if (selecionadas === null || selecionadas.length === campanhas.length) {
      return "Todas as campanhas";
    }
    if (selecionadas.length === 0) return "Nenhuma campanha";
    if (selecionadas.length === 1) {
      return campanhas.find((c) => c.id === selecionadas[0])?.nome ?? "1 campanha";
    }
    return `${selecionadas.length} campanhas`;
  })();

  function alternar(id: string) {
    const base = selecionadas ?? campanhas.map((c) => c.id);
    const nova = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    onChange(nova);
  }

  if (campanhas.length === 0) return null;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand"
      >
        <span className="truncate">{rotulo}</span>
        <ChevronDown className="size-3.5 shrink-0 text-ink-muted" />
      </button>

      {aberto ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-card-hover">
          <div className="flex items-center justify-between px-2 pb-2">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Selecionar todas
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-ink-muted hover:text-ink"
            >
              Limpar
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {campanhas.map((c) => {
              const marcada = selecionadas === null || selecionadas.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => alternar(c.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
                >
                  <span
                    className={
                      marcada
                        ? "mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-brand bg-brand"
                        : "mt-0.5 grid size-4 shrink-0 place-items-center rounded border border-input"
                    }
                  >
                    {marcada ? <Check className="size-3 text-brand-foreground" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{c.nome}</span>
                    {c.status ? (
                      <span className="block truncate text-[11px] text-ink-muted">{c.status}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
