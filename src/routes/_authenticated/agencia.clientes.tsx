import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, Search, Users } from "lucide-react";
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
        content: "Gerencie as contas dos clientes people: nome, identificador de cliente e nível de acesso.",
      },
      { property: "og:title", content: "Configurar Clientes — people" },
      {
        property: "og:description",
        content: "Painel da agência people para configurar contas e acessos dos clientes.",
      },
    ],
  }),
  component: ConfigurarClientes,
});

type Conta = {
  id: string;
  nome: string | null;
  email: string;
  role: "cliente" | "agencia";
  cliente_id: string | null;
};

function ConfigurarClientes() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:py-12">
            <Link
              to="/agencia"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Voltar ao menu
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card-violet">
                <Users className="size-5 text-brand-foreground" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink">Configurar Clientes</h1>
                <p className="text-sm text-ink-muted">
                  Ajuste nome, identificador de cliente e nível de acesso das contas.
                </p>
              </div>
            </div>

            <ListaContas />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function ListaContas() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("profiles")
      .select("id, nome, email, role, cliente_id")
      .order("email")
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro("Não foi possível carregar as contas.");
        else setContas((data as Conta[]) ?? []);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contas;
    return contas.filter(
      (c) =>
        c.email.toLowerCase().includes(termo) ||
        (c.nome ?? "").toLowerCase().includes(termo) ||
        (c.cliente_id ?? "").toLowerCase().includes(termo),
    );
  }, [contas, busca]);

  function alterar(id: string, campo: keyof Conta, valor: string) {
    setContas((atual) =>
      atual.map((c) => (c.id === id ? { ...c, [campo]: valor === "" ? null : valor } : c)),
    );
    setSalvoId(null);
  }

  async function salvar(conta: Conta) {
    setSalvandoId(conta.id);
    setErro(null);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: conta.nome ?? "", role: conta.role, cliente_id: conta.cliente_id })
      .eq("id", conta.id);
    setSalvandoId(null);
    if (error) return setErro("Não foi possível salvar. Verifique suas permissões.");
    setSalvoId(conta.id);
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
      <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
        <Search className="size-4 shrink-0 text-ink-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail ou identificador"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      {erro ? <p className="mt-4 text-sm text-destructive">{erro}</p> : null}

      {filtradas.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center shadow-card">
          <p className="text-sm text-ink-muted">
            Nenhuma conta encontrada. As contas aparecem aqui após o cliente criar o acesso no portal.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {filtradas.map((conta) => (
            <div
              key={conta.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="truncate text-sm font-semibold text-ink">{conta.email}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {conta.role}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Nome</span>
                  <input
                    value={conta.nome ?? ""}
                    onChange={(e) => alterar(conta.id, "nome", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
                    placeholder="Nome do contato"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Identificador do cliente</span>
                  <input
                    value={conta.cliente_id ?? ""}
                    onChange={(e) => alterar(conta.id, "cliente_id", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
                    placeholder="ex.: acme"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Nível de acesso</span>
                  <select
                    value={conta.role}
                    onChange={(e) => alterar(conta.id, "role", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand"
                  >
                    <option value="cliente">cliente</option>
                    <option value="agencia">agencia</option>
                  </select>
                </label>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => void salvar(conta)}
                  disabled={salvandoId === conta.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {salvandoId === conta.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  Salvar
                </button>
                {salvoId === conta.id ? (
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
