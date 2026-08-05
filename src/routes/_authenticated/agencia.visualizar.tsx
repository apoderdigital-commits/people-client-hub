import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, LayoutDashboard, Loader2, Search } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { definirClienteSelecionado } from "@/lib/visao-cliente";

export const Route = createFileRoute("/_authenticated/agencia/visualizar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Selecionar Cliente — people" },
      {
        name: "description",
        content: "Escolha qual cliente people você quer visualizar no portal do cliente.",
      },
      { property: "og:title", content: "Selecionar Cliente — people" },
      {
        property: "og:description",
        content: "Selecione a conta do cliente para abrir o portal com a visão dele.",
      },
    ],
  }),
  component: SelecionarCliente,
});

type Conta = {
  id: string;
  nome: string | null;
  email: string;
  cliente_id: string | null;
};

function SelecionarCliente() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto w-full max-w-[720px] px-4 py-8 sm:py-12">
            <Link
              to="/agencia"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-4" />
              Voltar ao menu
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card-indigo">
                <LayoutDashboard className="size-5 text-brand-foreground" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink">Selecionar Cliente</h1>
                <p className="text-sm text-ink-muted">
                  Escolha a conta para abrir o portal com a visão do cliente.
                </p>
              </div>
            </div>

            <Lista />
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function Lista() {
  const navigate = useNavigate();
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    supabase
      .from("profiles")
      .select("id, nome, email, cliente_id")
      .eq("role", "cliente")
      .order("nome", { ascending: true })
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro(error.message);
        else setContas((data as Conta[]) ?? []);
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return contas;
    return contas.filter(
      (c) => (c.nome ?? "").toLowerCase().includes(t) || c.email.toLowerCase().includes(t),
    );
  }, [busca, contas]);

  function abrir(conta: Conta) {
    definirClienteSelecionado({
      id: conta.id,
      nome: conta.nome ?? conta.email,
      email: conta.email,
      cliente_id: conta.cliente_id,
    });
    navigate({ to: "/cliente" });
  }

  if (carregando) {
    return (
      <div className="mt-8 grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    );
  }

  if (erro) {
    return <p className="mt-8 text-sm text-destructive">{erro}</p>;
  }

  return (
    <div className="mt-7">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand"
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          Nenhum cliente encontrado. Cadastre contas em Configurar Clientes.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {filtradas.map((conta) => (
            <button
              key={conta.id}
              type="button"
              onClick={() => abrir(conta)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                {(conta.nome || conta.email).trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">
                  {conta.nome || conta.email}
                </span>
                <span className="block truncate text-xs text-ink-muted">{conta.email}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
