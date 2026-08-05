import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Loader2, Search, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import type { Perfil } from "@/hooks/use-auth";
import {
  ABAS,
  ehAdminEquipe,
  lerPermissoes,
  niveisQuePodeConceder,
  rotuloNivel,
  type EquipeRole,
  type NivelVisualizacao,
  type Permissoes,
} from "@/lib/equipe";

export const Route = createFileRoute("/_authenticated/agencia/equipe")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Equipe people — Credenciais e Acessos" },
      {
        name: "description",
        content:
          "Configure credenciais, níveis de acesso e permissões por aba do time people.",
      },
      { property: "og:title", content: "Equipe people — Credenciais e Acessos" },
      {
        property: "og:description",
        content: "Gestão de acessos internos do time people, com permissões por aba.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EquipePagina,
});

type Membro = {
  id: string;
  nome: string | null;
  email: string;
  role: "cliente" | "agencia";
  equipe_role: EquipeRole | null;
  permissoes: Permissoes;
};

function EquipePagina() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:py-12">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card-teal">
                <ShieldCheck className="size-5 text-brand-foreground" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold text-ink">Equipe people</h1>
                <p className="text-sm text-ink-muted">
                  Credenciais, níveis de acesso e permissões por aba.
                </p>
              </div>
            </div>

            {ehAdminEquipe(perfil.equipe_role) ? (
              <Lista perfil={perfil} />
            ) : (
              <p className="mt-7 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-ink-muted shadow-card">
                Esta área é restrita a super admin e admin.
              </p>
            )}
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}

function Lista({ perfil }: { perfil: Perfil }) {
  const niveisDisponiveis = niveisQuePodeConceder(perfil.equipe_role);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [salvoId, setSalvoId] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    supabase
      .from("profiles")
      .select("id, nome, email, role, equipe_role, permissoes")
      .order("email")
      .then(({ data, error }) => {
        if (!ativo) return;
        if (error) setErro("Não foi possível carregar a equipe.");
        else
          setMembros(
            (data ?? []).map((m) => ({
              id: m.id,
              nome: m.nome,
              email: m.email,
              role: m.role,
              equipe_role: (m.equipe_role as EquipeRole | null) ?? null,
              permissoes: lerPermissoes(m.permissoes),
            })),
          );
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return membros;
    return membros.filter(
      (m) => m.email.toLowerCase().includes(t) || (m.nome ?? "").toLowerCase().includes(t),
    );
  }, [membros, busca]);

  /** Admin não pode mexer em super admin nem em outro admin; super admin pode tudo. */
  function podeGerenciar(membro: Membro) {
    if (membro.id === perfil.id) return false;
    if (perfil.equipe_role === "super_admin") return true;
    return !ehAdminEquipe(membro.equipe_role);
  }

  function alterar(id: string, campo: "nome" | "role" | "equipe_role", valor: string) {
    setMembros((atual) =>
      atual.map((m) =>
        m.id === id ? { ...m, [campo]: valor === "" ? null : (valor as never) } : m,
      ),
    );
    setSalvoId(null);
  }

  function alterarPermissao(id: string, aba: string, valor: NivelVisualizacao) {
    setMembros((atual) =>
      atual.map((m) =>
        m.id === id ? { ...m, permissoes: { ...m.permissoes, [aba]: valor } } : m,
      ),
    );
    setSalvoId(null);
  }

  async function salvar(membro: Membro) {
    setSalvandoId(membro.id);
    setErro(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: membro.nome ?? "",
        role: membro.role,
        equipe_role: membro.equipe_role,
        permissoes: membro.permissoes,
      })
      .eq("id", membro.id);
    setSalvandoId(null);
    if (error) return setErro("Não foi possível salvar. Verifique suas permissões.");
    setSalvoId(membro.id);
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
      <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink-muted">
        {perfil.equipe_role === "super_admin"
          ? "Como super admin você pode conceder qualquer nível de acesso, inclusive admin."
          : "Como admin você pode conceder níveis de admin para baixo (gestor de tráfego, social media, gerente de projeto, designer e editor de vídeo)."}
      </p>

      <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
        <Search className="size-4 shrink-0 text-ink-muted" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      {erro ? <p className="mt-4 text-sm text-destructive">{erro}</p> : null}

      <div className="mt-5 flex flex-col gap-4">
        {filtrados.map((membro) => {
          const editavel = podeGerenciar(membro);
          const nivelAtualIndisponivel =
            membro.equipe_role !== null &&
            !niveisDisponiveis.some((n) => n.valor === membro.equipe_role);

          return (
            <div key={membro.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <p className="truncate text-sm font-semibold text-ink">{membro.email}</p>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  {membro.equipe_role ? rotuloNivel(membro.equipe_role) : membro.role}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Nome</span>
                  <input
                    value={membro.nome ?? ""}
                    disabled={!editavel}
                    onChange={(e) => alterar(membro.id, "nome", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
                    placeholder="Nome do integrante"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Tipo de conta</span>
                  <select
                    value={membro.role}
                    disabled={!editavel}
                    onChange={(e) => alterar(membro.id, "role", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
                  >
                    <option value="cliente">cliente</option>
                    <option value="agencia">equipe people</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-ink-muted">Nível de acesso</span>
                  <select
                    value={membro.equipe_role ?? ""}
                    disabled={!editavel}
                    onChange={(e) => alterar(membro.id, "equipe_role", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {niveisDisponiveis.map((n) => (
                      <option key={n.valor} value={n.valor}>
                        {n.label}
                      </option>
                    ))}
                    {nivelAtualIndisponivel ? (
                      <option value={membro.equipe_role as string}>
                        {rotuloNivel(membro.equipe_role)}
                      </option>
                    ) : null}
                  </select>
                </label>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Visualização por aba
                </p>
                {ehAdminEquipe(membro.equipe_role) ? (
                  <p className="mt-2 text-sm text-ink-muted">
                    Admin e super admin têm acesso total a todas as abas.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {ABAS.map((aba) => (
                      <label key={aba.chave} className="block">
                        <span className="text-xs font-medium text-ink-muted">{aba.label}</span>
                        <select
                          value={membro.permissoes[aba.chave] ?? "nenhum"}
                          disabled={!editavel}
                          onChange={(e) =>
                            alterarPermissao(
                              membro.id,
                              aba.chave,
                              e.target.value as NivelVisualizacao,
                            )
                          }
                          className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-brand disabled:opacity-60"
                        >
                          <option value="nenhum">Sem acesso</option>
                          <option value="ver">Visualizar</option>
                          <option value="editar">Visualizar e editar</option>
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {editavel ? (
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => void salvar(membro)}
                    disabled={salvandoId === membro.id}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {salvandoId === membro.id ? <Loader2 className="size-4 animate-spin" /> : null}
                    Salvar
                  </button>
                  {salvoId === membro.id ? (
                    <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                      <Check className="size-4" />
                      Salvo
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-xs text-ink-muted">
                  {membro.id === perfil.id
                    ? "Você não pode alterar o seu próprio nível de acesso."
                    : "Apenas o super admin pode alterar contas de admin."}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
