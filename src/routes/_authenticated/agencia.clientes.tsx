import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Plus, Search, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/agencia/clientes")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configurar Clientes — people" },
      {
        name: "description",
        content:
          "Cadastre clientes people com identificador, conta de anúncio, token Meta, investimento mensal e meta de faturamento.",
      },
      { property: "og:title", content: "Configurar Clientes — people" },
      {
        property: "og:description",
        content: "Painel da agência people para cadastrar e configurar as contas dos clientes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigurarClientes,
});

type Cliente = {
  id: string;
  nome: string;
  identificador: string;
  ad_account_id: string;
  meta_token: string;
  investimento_mensal: number;
  meta_faturamento: number;
};

const vazio = {
  nome: "",
  identificador: "",
  ad_account_id: "",
  meta_token: "",
  investimento_mensal: "",
  meta_faturamento: "",
};

function ConfigurarClientes() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:py-12">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card-violet">
                <Users className="size-5 text-brand-foreground" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink">Configurar Clientes</h1>
                <p className="text-sm text-ink-muted">
                  Cadastre clientes e configure conta de anúncio, token, investimento e metas.
                </p>
              </div>
            </div>

            <Painel />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function Campo({
  label,
  valor,
  onChange,
  placeholder,
  tipo = "text",
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
      />
    </label>
  );
}

function Painel() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState(vazio);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("clientes")
      .select("id, nome, identificador, ad_account_id, meta_token, investimento_mensal, meta_faturamento")
      .order("nome")
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro("Não foi possível carregar os clientes.");
        else setClientes((data as Cliente[]) ?? []);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.identificador.toLowerCase().includes(termo) ||
        c.ad_account_id.toLowerCase().includes(termo),
    );
  }, [clientes, busca]);

  function alterar(id: string, campo: keyof Cliente, valor: string) {
    setClientes((atual) =>
      atual.map((c) =>
        c.id === id
          ? {
              ...c,
              [campo]:
                campo === "investimento_mensal" || campo === "meta_faturamento"
                  ? Number(valor.replace(",", ".")) || 0
                  : valor,
            }
          : c,
      ),
    );
    setSalvoId(null);
  }

  async function salvar(cliente: Cliente) {
    setSalvandoId(cliente.id);
    setErro(null);
    const { error } = await supabase
      .from("clientes")
      .update({
        nome: cliente.nome,
        identificador: cliente.identificador,
        ad_account_id: cliente.ad_account_id,
        meta_token: cliente.meta_token,
        investimento_mensal: cliente.investimento_mensal,
        meta_faturamento: cliente.meta_faturamento,
      })
      .eq("id", cliente.id);
    setSalvandoId(null);
    if (error) return setErro("Não foi possível salvar. Verifique suas permissões.");
    setSalvoId(cliente.id);
  }

  async function criar() {
    if (!novo.nome.trim() || !novo.identificador.trim()) {
      return setErro("Informe nome e identificador do cliente.");
    }
    setSalvandoNovo(true);
    setErro(null);
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: novo.nome.trim(),
        identificador: novo.identificador.trim().toLowerCase(),
        ad_account_id: novo.ad_account_id.trim(),
        meta_token: novo.meta_token.trim(),
        investimento_mensal: Number(novo.investimento_mensal.replace(",", ".")) || 0,
        meta_faturamento: Number(novo.meta_faturamento.replace(",", ".")) || 0,
      })
      .select("id, nome, identificador, ad_account_id, meta_token, investimento_mensal, meta_faturamento")
      .single();
    setSalvandoNovo(false);
    if (error || !data) {
      return setErro(
        error?.code === "23505"
          ? "Já existe um cliente com esse identificador."
          : "Não foi possível criar o cliente.",
      );
    }
    setClientes((atual) => [...atual, data as Cliente].sort((a, b) => a.nome.localeCompare(b.nome)));
    setNovo(vazio);
    setCriando(false);
  }

  if (carregando) {
    return (
      <div className="mt-10 grid place-items-center">
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="mt-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
          <Search className="size-4 shrink-0 text-ink-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, identificador ou conta de anúncio"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <button
          type="button"
          onClick={() => setCriando((v) => !v)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo cliente
        </button>
      </div>

      {erro ? <p className="mt-4 text-sm text-destructive">{erro}</p> : null}

      {criando ? (
        <div className="mt-5 rounded-2xl border border-brand/40 bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Novo cliente</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Campo
              label="Nome do cliente"
              valor={novo.nome}
              onChange={(v) => setNovo((n) => ({ ...n, nome: v }))}
              placeholder="Acme Ltda"
            />
            <Campo
              label="Identificador"
              valor={novo.identificador}
              onChange={(v) => setNovo((n) => ({ ...n, identificador: v }))}
              placeholder="acme"
            />
            <Campo
              label="ID da conta de anúncio"
              valor={novo.ad_account_id}
              onChange={(v) => setNovo((n) => ({ ...n, ad_account_id: v }))
              }
              placeholder="act_123456789"
            />
            <Campo
              label="Token Meta"
              valor={novo.meta_token}
              onChange={(v) => setNovo((n) => ({ ...n, meta_token: v }))}
              placeholder="EAAG..."
            />
            <Campo
              label="Investimento mensal em tráfego (R$)"
              valor={novo.investimento_mensal}
              onChange={(v) => setNovo((n) => ({ ...n, investimento_mensal: v }))}
              placeholder="15000"
              tipo="number"
            />
            <Campo
              label="Meta de faturamento / mês (R$)"
              valor={novo.meta_faturamento}
              onChange={(v) => setNovo((n) => ({ ...n, meta_faturamento: v }))}
              placeholder="150000"
              tipo="number"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void criar()}
              disabled={salvandoNovo}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {salvandoNovo ? <Loader2 className="size-4 animate-spin" /> : null}
              Criar cliente
            </button>
            <button
              type="button"
              onClick={() => {
                setCriando(false);
                setNovo(vazio);
              }}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {filtrados.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm text-ink-muted">
            Nenhum cliente cadastrado ainda. Use “Novo cliente” para começar.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {filtrados.map((cliente) => (
            <div key={cliente.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="truncate text-sm font-semibold text-ink">{cliente.nome}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {cliente.identificador}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Nome do cliente"
                  valor={cliente.nome}
                  onChange={(v) => alterar(cliente.id, "nome", v)}
                />
                <Campo
                  label="Identificador"
                  valor={cliente.identificador}
                  onChange={(v) => alterar(cliente.id, "identificador", v)}
                />
                <Campo
                  label="ID da conta de anúncio"
                  valor={cliente.ad_account_id}
                  onChange={(v) => alterar(cliente.id, "ad_account_id", v)}
                />
                <Campo
                  label="Token Meta"
                  valor={cliente.meta_token}
                  onChange={(v) => alterar(cliente.id, "meta_token", v)}
                />
                <Campo
                  label="Investimento mensal em tráfego (R$)"
                  valor={String(cliente.investimento_mensal)}
                  onChange={(v) => alterar(cliente.id, "investimento_mensal", v)}
                  tipo="number"
                />
                <Campo
                  label="Meta de faturamento / mês (R$)"
                  valor={String(cliente.meta_faturamento)}
                  onChange={(v) => alterar(cliente.id, "meta_faturamento", v)}
                  tipo="number"
                />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => void salvar(cliente)}
                  disabled={salvandoId === cliente.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {salvandoId === cliente.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  Salvar
                </button>
                {salvoId === cliente.id ? (
                  <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                    <Check className="size-4" />
                    Salvo
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
