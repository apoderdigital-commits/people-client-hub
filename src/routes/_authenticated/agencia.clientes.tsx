import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, Check, KeyRound, Loader2, Plus, RefreshCw, Search, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { permissoesEfetivas, podeEditar, podeVer } from "@/lib/equipe";
import { supabase } from "@/integrations/supabase/client";
import {
  criarClienteComMeta,
  salvarTokenMeta,
  sincronizarMetricasMeta,
} from "@/lib/clientes.functions";

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

/**
 * O token da Meta não aparece aqui de propósito: ele vive em `clientes_secrets`,
 * fora do alcance do PostgREST, e só o servidor o lê. A tela mostra apenas se
 * existe token configurado e permite substituí-lo.
 */
type Cliente = {
  id: string;
  nome: string;
  identificador: string;
  ad_account_id: string;
  investimento_mensal: number;
  meta_faturamento: number;
  token_atualizado_em: string | null;
  ultima_sincronizacao: string | null;
  erro_sincronizacao: string | null;
};

const COLUNAS =
  "id, nome, identificador, ad_account_id, investimento_mensal, meta_faturamento, token_atualizado_em, ultima_sincronizacao, erro_sincronizacao";

/** types.ts é gerado pelo Lovable e ainda não conhece as colunas novas. */
const db = supabase as unknown as SupabaseClient;

const vazio = {
  nome: "",
  identificador: "",
  ad_account_id: "",
  meta_token: "",
  investimento_mensal: "",
  meta_faturamento: "",
};

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

            {(() => {
              const permissoes = permissoesEfetivas(perfil.equipe_role, perfil.permissoes);
              if (!podeVer(permissoes, "clientes")) {
                return (
                  <p className="mt-7 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-ink-muted shadow-card">
                    Você não tem permissão para visualizar esta aba.
                  </p>
                );
              }
              const somenteLeitura = !podeEditar(permissoes, "clientes");
              return (
                <>
                  {somenteLeitura ? (
                    <p className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink-muted">
                      Seu acesso a esta aba é somente de visualização.
                    </p>
                  ) : null}
                  <fieldset disabled={somenteLeitura} className="min-w-0 border-0 p-0">
                    <Painel />
                  </fieldset>
                </>
              );
            })()}

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
  ajuda,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  ajuda?: string;
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
      {ajuda ? <span className="mt-1 block text-[11px] text-ink-muted">{ajuda}</span> : null}
    </label>
  );
}

function Painel() {
  const criarCliente = useServerFn(criarClienteComMeta);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState(vazio);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  useEffect(() => {
    let ativo = true;
    db.from("clientes")
      .select(COLUNAS)
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

  function atualizarNaLista(id: string, mudancas: Partial<Cliente>) {
    setClientes((atual) => atual.map((c) => (c.id === id ? { ...c, ...mudancas } : c)));
  }

  async function salvar(cliente: Cliente) {
    setSalvandoId(cliente.id);
    setErro(null);
    const { error } = await db
      .from("clientes")
      .update({
        nome: cliente.nome,
        identificador: cliente.identificador,
        ad_account_id: cliente.ad_account_id,
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
    setAviso(null);
    try {
      const res = await criarCliente({
        data: {
          nome: novo.nome.trim(),
          identificador: novo.identificador.trim().toLowerCase(),
          ad_account_id: novo.ad_account_id.trim(),
          meta_token: novo.meta_token.trim(),
          investimento_mensal: Number(novo.investimento_mensal.replace(",", ".")) || 0,
          meta_faturamento: Number(novo.meta_faturamento.replace(",", ".")) || 0,
        },
      });

      const agora = new Date().toISOString();
      const temMeta = Boolean(novo.ad_account_id.trim() && novo.meta_token.trim());
      setClientes((atual) =>
        [
          ...atual,
          {
            id: res.id,
            nome: novo.nome.trim(),
            identificador: novo.identificador.trim().toLowerCase(),
            ad_account_id: novo.ad_account_id.trim(),
            investimento_mensal: Number(novo.investimento_mensal.replace(",", ".")) || 0,
            meta_faturamento: Number(novo.meta_faturamento.replace(",", ".")) || 0,
            token_atualizado_em: temMeta ? agora : null,
            ultima_sincronizacao: res.sincronizado > 0 ? agora : null,
            erro_sincronizacao: null,
          },
        ].sort((a, b) => a.nome.localeCompare(b.nome)),
      );

      setAviso(
        res.sincronizado > 0
          ? `Cliente criado e ${res.sincronizado} dias de métricas importados da Meta.`
          : temMeta
            ? "Cliente criado, mas nenhuma métrica veio da Meta. Use Sincronizar no card para ver o motivo."
            : "Cliente criado. Configure conta de anúncio e token para importar as métricas.",
      );
      setNovo(vazio);
      setCriando(false);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível criar o cliente.");
    }
    setSalvandoNovo(false);
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
      {aviso ? (
        <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-success">
          {aviso}
        </p>
      ) : null}

      {criando ? (
        <div className="mt-5 rounded-2xl border border-brand/40 bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold text-ink">Novo cliente</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Com a conta de anúncio e o token preenchidos, as métricas dos últimos 30 dias são
            importadas da Meta na hora do cadastro.
          </p>
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
              ajuda="Apenas letras minúsculas, números e hífen."
            />
            <Campo
              label="ID da conta de anúncio"
              valor={novo.ad_account_id}
              onChange={(v) => setNovo((n) => ({ ...n, ad_account_id: v }))}
              placeholder="act_123456789"
            />
            <Campo
              label="Token Meta"
              valor={novo.meta_token}
              onChange={(v) => setNovo((n) => ({ ...n, meta_token: v }))}
              placeholder="EAAG..."
              tipo="password"
              ajuda="Guardado no servidor; não volta a ser exibido."
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
              {salvandoNovo ? "Validando com a Meta…" : "Criar cliente"}
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

              <Meta
                cliente={cliente}
                onAtualizar={(mudancas) => atualizarNaLista(cliente.id, mudancas)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bloco de integração com a Meta: estado da credencial e sincronização. */
function Meta({
  cliente,
  onAtualizar,
}: {
  cliente: Cliente;
  onAtualizar: (mudancas: Partial<Cliente>) => void;
}) {
  const salvarToken = useServerFn(salvarTokenMeta);
  const sincronizar = useServerFn(sincronizarMetricasMeta);
  const [token, setToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const configurado = Boolean(cliente.token_atualizado_em);

  async function enviarToken() {
    if (!cliente.ad_account_id.trim()) {
      return setErro("Informe o ID da conta de anúncio e salve antes de cadastrar o token.");
    }
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      const res = await salvarToken({
        data: {
          clienteId: cliente.id,
          ad_account_id: cliente.ad_account_id.trim(),
          meta_token: token.trim(),
        },
      });
      setToken("");
      onAtualizar({ token_atualizado_em: new Date().toISOString(), erro_sincronizacao: null });
      setOk(`Token validado na conta "${res.conta}".`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar o token.");
    }
    setSalvando(false);
  }

  async function puxar() {
    setSincronizando(true);
    setErro(null);
    setOk(null);
    try {
      const res = await sincronizar({ data: { clienteId: cliente.id, dias: 30 } });
      onAtualizar({
        ultima_sincronizacao: new Date().toISOString(),
        erro_sincronizacao: null,
      });
      setOk(
        res.dias > 0
          ? `${res.dias} dias de métricas atualizados.`
          : "A Meta não devolveu dados para este período.",
      );
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : "Falha ao sincronizar.";
      setErro(mensagem);
      onAtualizar({ erro_sincronizacao: mensagem });
    }
    setSincronizando(false);
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Meta Ads</p>
        <span className="text-[11px] text-ink-muted">
          {configurado ? "Token configurado" : "Sem token"} · última sincronização:{" "}
          {quando(cliente.ultima_sincronizacao)}
        </span>
      </div>

      {cliente.erro_sincronizacao ? (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {cliente.erro_sincronizacao}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="text-xs font-medium text-ink-muted">
            {configurado ? "Substituir token" : "Token Meta"}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={configurado ? "••••••••  (deixe em branco para manter)" : "EAAG..."}
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
          />
        </label>
        <button
          type="button"
          onClick={() => void enviarToken()}
          disabled={salvando || token.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand disabled:opacity-60"
        >
          {salvando ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {salvando ? "Validando…" : "Salvar token"}
        </button>
        <button
          type="button"
          onClick={() => void puxar()}
          disabled={sincronizando || !configurado}
          className="inline-flex items-center gap-2 rounded-xl border border-input px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${sincronizando ? "animate-spin" : ""}`} />
          {sincronizando ? "Sincronizando…" : "Sincronizar"}
        </button>
      </div>

      {erro ? <p className="mt-2 text-sm text-destructive">{erro}</p> : null}
      {ok ? <p className="mt-2 text-sm text-success">{ok}</p> : null}
    </div>
  );
}
