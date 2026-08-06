import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { permissoesEfetivas, podeEditar, podeVer } from "@/lib/equipe";

export const Route = createFileRoute("/_authenticated/agencia/fluxo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fluxo People — Quadro de produção" },
      {
        name: "description",
        content:
          "Quadro de produção do time people: acompanhe cada peça da criação até a campanha no ar.",
      },
      { property: "og:title", content: "Fluxo People — Quadro de produção" },
      {
        property: "og:description",
        content: "Kanban interno do time people, com responsáveis, prazos e cliente por cartão.",
      },
    ],
  }),
  component: FluxoPagina,
});

/** types.ts é gerado pelo Lovable e ainda não conhece as tabelas do fluxo. */
const db = supabase as unknown as SupabaseClient;

type Coluna = { id: string; nome: string; ordem: number };
type Cartao = {
  id: string;
  coluna_id: string;
  titulo: string;
  cliente_id: string | null;
  prazo: string | null;
  ordem: number;
};
type Vinculo = { cartao_id: string; perfil_id: string };
type Membro = { id: string; nome: string | null; email: string };
type ClienteRef = { id: string; nome: string };

function iniciais(texto: string): string {
  const limpo = texto.trim();
  if (!limpo) return "?";
  const partes = limpo.split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function FluxoPagina() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => {
        const permissoes = permissoesEfetivas(perfil.equipe_role, perfil.permissoes);
        return (
          <div className="min-h-screen bg-background">
            <AppHeader perfil={perfil} />
            <main className="w-full px-4 py-8">
              <div className="mx-auto w-full max-w-[1400px]">
                <Link
                  to="/agencia"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  <ArrowLeft className="size-4" />
                  Voltar ao menu
                </Link>
                <div className="mt-4 flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-card-amber">
                    <LayoutGrid className="size-5 text-brand-foreground" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold text-ink">Fluxo People</h1>
                    <p className="text-sm text-ink-muted">
                      Quadro de produção do time, da criação à campanha no ar.
                    </p>
                  </div>
                </div>

                {!podeVer(permissoes, "fluxo") ? (
                  <p className="mt-7 rounded-2xl border border-border bg-card px-4 py-6 text-sm text-ink-muted shadow-card">
                    Você não tem permissão para visualizar esta aba.
                  </p>
                ) : (
                  <Quadro editavel={podeEditar(permissoes, "fluxo")} />
                )}
              </div>
            </main>
          </div>
        );
      }}
    </ProtectedRoute>
  );
}

function Quadro({ editavel }: { editavel: boolean }) {
  const [colunas, setColunas] = useState<Coluna[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [novaColuna, setNovaColuna] = useState("");

  const carregar = useCallback(async () => {
    const [c, k, v, m, cl] = await Promise.all([
      db.from("fluxo_colunas").select("id, nome, ordem").order("ordem"),
      db.from("fluxo_cartoes").select("id, coluna_id, titulo, cliente_id, prazo, ordem").order("ordem"),
      db.from("fluxo_responsaveis").select("cartao_id, perfil_id"),
      db.from("profiles").select("id, nome, email").eq("role", "agencia").order("nome"),
      db.from("clientes").select("id, nome").order("nome"),
    ]);

    const falha = c.error ?? k.error ?? v.error ?? m.error ?? cl.error;
    if (falha) setErro(falha.message);
    else setErro(null);

    setColunas((c.data as Coluna[]) ?? []);
    setCartoes((k.data as Cartao[]) ?? []);
    setVinculos((v.data as Vinculo[]) ?? []);
    setMembros((m.data as Membro[]) ?? []);
    setClientes((cl.data as ClienteRef[]) ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const porColuna = useMemo(() => {
    const mapa = new Map<string, Cartao[]>();
    for (const coluna of colunas) mapa.set(coluna.id, []);
    for (const cartao of cartoes) {
      const lista = mapa.get(cartao.coluna_id);
      if (lista) lista.push(cartao);
    }
    for (const lista of mapa.values()) lista.sort((a, b) => a.ordem - b.ordem);
    return mapa;
  }, [colunas, cartoes]);

  // --- colunas ---

  async function criarColuna() {
    const nome = novaColuna.trim();
    if (!nome) return;
    const ordem = colunas.length;
    setNovaColuna("");
    const { data, error } = await db
      .from("fluxo_colunas")
      .insert({ nome, ordem })
      .select("id, nome, ordem")
      .single();
    if (error) return setErro("Não foi possível criar a coluna.");
    setColunas((atual) => [...atual, data as Coluna]);
  }

  async function renomearColuna(id: string, nome: string) {
    setColunas((atual) => atual.map((c) => (c.id === id ? { ...c, nome } : c)));
    const { error } = await db.from("fluxo_colunas").update({ nome }).eq("id", id);
    if (error) setErro("Não foi possível renomear a coluna.");
  }

  async function removerColuna(id: string) {
    const cartoesDaColuna = porColuna.get(id) ?? [];
    if (cartoesDaColuna.length > 0) {
      return setErro("Mova ou exclua os cartões antes de remover a coluna.");
    }
    setColunas((atual) => atual.filter((c) => c.id !== id));
    const { error } = await db.from("fluxo_colunas").delete().eq("id", id);
    if (error) {
      setErro("Não foi possível remover a coluna.");
      void carregar();
    }
  }

  async function moverColuna(id: string, direcao: -1 | 1) {
    const i = colunas.findIndex((c) => c.id === id);
    const j = i + direcao;
    if (i < 0 || j < 0 || j >= colunas.length) return;
    const nova = [...colunas];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    const reordenadas = nova.map((c, idx) => ({ ...c, ordem: idx }));
    setColunas(reordenadas);
    await Promise.all(
      reordenadas
        .filter((c, idx) => colunas[idx]?.id !== c.id)
        .map((c) => db.from("fluxo_colunas").update({ ordem: c.ordem }).eq("id", c.id)),
    );
  }

  // --- cartões ---

  async function criarCartao(colunaId: string, titulo: string) {
    const ordem = (porColuna.get(colunaId) ?? []).length;
    const { data, error } = await db
      .from("fluxo_cartoes")
      .insert({ coluna_id: colunaId, titulo, ordem })
      .select("id, coluna_id, titulo, cliente_id, prazo, ordem")
      .single();
    if (error) return setErro("Não foi possível criar o cartão.");
    setCartoes((atual) => [...atual, data as Cartao]);
  }

  async function atualizarCartao(id: string, campos: Partial<Cartao>) {
    setCartoes((atual) => atual.map((c) => (c.id === id ? { ...c, ...campos } : c)));
    const { error } = await db.from("fluxo_cartoes").update(campos).eq("id", id);
    if (error) setErro("Não foi possível salvar o cartão.");
  }

  async function removerCartao(id: string) {
    setCartoes((atual) => atual.filter((c) => c.id !== id));
    setVinculos((atual) => atual.filter((v) => v.cartao_id !== id));
    const { error } = await db.from("fluxo_cartoes").delete().eq("id", id);
    if (error) {
      setErro("Não foi possível excluir o cartão.");
      void carregar();
    }
  }

  /**
   * Move o cartão para outra coluna (ou outra posição na mesma) e regrava a
   * ordem das colunas afetadas. O quadro é pequeno, então reindexar tudo é
   * mais simples e previsível do que calcular ordens fracionárias.
   */
  async function moverCartao(cartaoId: string, colunaDestino: string, indice: number | null) {
    const cartao = cartoes.find((c) => c.id === cartaoId);
    if (!cartao) return;

    const origem = (porColuna.get(cartao.coluna_id) ?? []).filter((c) => c.id !== cartaoId);
    const destino =
      cartao.coluna_id === colunaDestino
        ? origem
        : [...(porColuna.get(colunaDestino) ?? [])];

    const posicao = indice === null || indice > destino.length ? destino.length : indice;
    destino.splice(posicao, 0, { ...cartao, coluna_id: colunaDestino });

    const atualizacoes: Cartao[] = [];
    destino.forEach((c, idx) => {
      if (c.coluna_id !== colunaDestino || c.ordem !== idx) {
        atualizacoes.push({ ...c, coluna_id: colunaDestino, ordem: idx });
      }
    });
    if (cartao.coluna_id !== colunaDestino) {
      origem.forEach((c, idx) => {
        if (c.ordem !== idx) atualizacoes.push({ ...c, ordem: idx });
      });
    }

    setCartoes((atual) =>
      atual.map((c) => {
        const novo = atualizacoes.find((a) => a.id === c.id);
        return novo ? { ...c, coluna_id: novo.coluna_id, ordem: novo.ordem } : c;
      }),
    );

    const { error } = await db.from("fluxo_cartoes").upsert(
      atualizacoes.map((c) => ({
        id: c.id,
        coluna_id: c.coluna_id,
        titulo: c.titulo,
        cliente_id: c.cliente_id,
        prazo: c.prazo,
        ordem: c.ordem,
      })),
      { onConflict: "id" },
    );
    if (error) {
      setErro("Não foi possível mover o cartão.");
      void carregar();
    }
  }

  async function definirResponsaveis(cartaoId: string, ids: string[]) {
    const atuais = vinculos.filter((v) => v.cartao_id === cartaoId).map((v) => v.perfil_id);
    const adicionar = ids.filter((id) => !atuais.includes(id));
    const remover = atuais.filter((id) => !ids.includes(id));

    setVinculos((atual) => [
      ...atual.filter((v) => v.cartao_id !== cartaoId),
      ...ids.map((perfil_id) => ({ cartao_id: cartaoId, perfil_id })),
    ]);

    if (adicionar.length > 0) {
      const { error } = await db
        .from("fluxo_responsaveis")
        .insert(adicionar.map((perfil_id) => ({ cartao_id: cartaoId, perfil_id })));
      if (error) setErro("Não foi possível salvar os responsáveis.");
    }
    if (remover.length > 0) {
      const { error } = await db
        .from("fluxo_responsaveis")
        .delete()
        .eq("cartao_id", cartaoId)
        .in("perfil_id", remover);
      if (error) setErro("Não foi possível remover os responsáveis.");
    }
  }

  if (carregando) {
    return (
      <div className="mt-10 grid place-items-center py-10">
        <Loader2 className="size-5 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="mt-7">
      {erro ? (
        <p className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          {erro}
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso">
            <X className="size-4" />
          </button>
        </p>
      ) : null}

      {!editavel ? (
        <p className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink-muted">
          Seu acesso a esta aba é somente de visualização.
        </p>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {colunas.map((coluna, i) => (
          <ColunaKanban
            key={coluna.id}
            coluna={coluna}
            primeira={i === 0}
            ultima={i === colunas.length - 1}
            cartoes={porColuna.get(coluna.id) ?? []}
            membros={membros}
            clientes={clientes}
            vinculos={vinculos}
            editavel={editavel}
            arrastando={arrastando}
            onArrastar={setArrastando}
            onCriarCartao={criarCartao}
            onAtualizarCartao={atualizarCartao}
            onRemoverCartao={removerCartao}
            onMoverCartao={moverCartao}
            onDefinirResponsaveis={definirResponsaveis}
            onRenomear={renomearColuna}
            onRemover={removerColuna}
            onMoverColuna={moverColuna}
            colunas={colunas}
          />
        ))}

        {editavel ? (
          <div className="w-72 shrink-0">
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-3">
              <input
                value={novaColuna}
                onChange={(e) => setNovaColuna(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void criarColuna();
                }}
                placeholder="Nome da nova coluna"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => void criarColuna()}
                disabled={!novaColuna.trim()}
                className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="size-3.5" />
                Adicionar coluna
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ColunaKanban({
  coluna,
  colunas,
  primeira,
  ultima,
  cartoes,
  membros,
  clientes,
  vinculos,
  editavel,
  arrastando,
  onArrastar,
  onCriarCartao,
  onAtualizarCartao,
  onRemoverCartao,
  onMoverCartao,
  onDefinirResponsaveis,
  onRenomear,
  onRemover,
  onMoverColuna,
}: {
  coluna: Coluna;
  colunas: Coluna[];
  primeira: boolean;
  ultima: boolean;
  cartoes: Cartao[];
  membros: Membro[];
  clientes: ClienteRef[];
  vinculos: Vinculo[];
  editavel: boolean;
  arrastando: string | null;
  onArrastar: (id: string | null) => void;
  onCriarCartao: (colunaId: string, titulo: string) => Promise<void>;
  onAtualizarCartao: (id: string, campos: Partial<Cartao>) => Promise<void>;
  onRemoverCartao: (id: string) => Promise<void>;
  onMoverCartao: (id: string, colunaDestino: string, indice: number | null) => Promise<void>;
  onDefinirResponsaveis: (cartaoId: string, ids: string[]) => Promise<void>;
  onRenomear: (id: string, nome: string) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onMoverColuna: (id: string, direcao: -1 | 1) => Promise<void>;
}) {
  const [novo, setNovo] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [nome, setNome] = useState(coluna.nome);
  const [sobre, setSobre] = useState(false);

  useEffect(() => {
    setNome(coluna.nome);
  }, [coluna.nome]);

  function soltar(indice: number | null) {
    if (!arrastando) return;
    void onMoverCartao(arrastando, coluna.id, indice);
    onArrastar(null);
    setSobre(false);
  }

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-card p-3 transition-colors ${
        sobre ? "border-brand" : "border-border"
      }`}
      onDragOver={(e) => {
        if (!editavel || !arrastando) return;
        e.preventDefault();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        if (!editavel) return;
        e.preventDefault();
        soltar(null);
      }}
    >
      <div className="flex items-center gap-1">
        {editavel ? (
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => {
              const limpo = nome.trim();
              if (limpo && limpo !== coluna.nome) void onRenomear(coluna.id, limpo);
              else setNome(coluna.nome);
            }}
            className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-xs font-bold uppercase tracking-wide text-ink outline-none transition-colors hover:bg-muted focus:bg-muted"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate px-1 text-xs font-bold uppercase tracking-wide text-ink">
            {coluna.nome}
          </span>
        )}
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] font-semibold text-ink-muted">
          {cartoes.length}
        </span>
      </div>

      {editavel ? (
        <div className="mt-1 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => void onMoverColuna(coluna.id, -1)}
            disabled={primeira}
            className="rounded p-0.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
            aria-label="Mover coluna para a esquerda"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onMoverColuna(coluna.id, 1)}
            disabled={ultima}
            className="rounded p-0.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-30"
            aria-label="Mover coluna para a direita"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void onRemover(coluna.id)}
            className="ml-auto rounded p-0.5 text-ink-muted transition-colors hover:text-destructive"
            aria-label="Remover coluna"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex min-h-[40px] flex-col gap-2">
        {cartoes.map((cartao, i) => (
          <CartaoKanban
            key={cartao.id}
            cartao={cartao}
            colunas={colunas}
            membros={membros}
            clientes={clientes}
            responsaveis={vinculos
              .filter((v) => v.cartao_id === cartao.id)
              .map((v) => v.perfil_id)}
            editavel={editavel}
            onArrastar={onArrastar}
            onSoltarAntes={() => soltar(i)}
            onAtualizar={onAtualizarCartao}
            onRemover={onRemoverCartao}
            onMover={onMoverCartao}
            onDefinirResponsaveis={onDefinirResponsaveis}
          />
        ))}
      </div>

      {editavel ? (
        adicionando ? (
          <div className="mt-2">
            <textarea
              autoFocus
              value={novo}
              onChange={(e) => setNovo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  const titulo = novo.trim();
                  if (titulo) {
                    void onCriarCartao(coluna.id, titulo);
                    setNovo("");
                  }
                }
                if (e.key === "Escape") setAdicionando(false);
              }}
              rows={2}
              placeholder="Título do cartão"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const titulo = novo.trim();
                  if (titulo) {
                    void onCriarCartao(coluna.id, titulo);
                    setNovo("");
                  }
                }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdicionando(false);
                  setNovo("");
                }}
                className="text-xs font-medium text-ink-muted hover:text-ink"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdicionando(true)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-muted hover:text-ink"
          >
            <Plus className="size-3.5" />
            Adicionar um cartão
          </button>
        )
      ) : null}
    </div>
  );
}

function CartaoKanban({
  cartao,
  colunas,
  membros,
  clientes,
  responsaveis,
  editavel,
  onArrastar,
  onSoltarAntes,
  onAtualizar,
  onRemover,
  onMover,
  onDefinirResponsaveis,
}: {
  cartao: Cartao;
  colunas: Coluna[];
  membros: Membro[];
  clientes: ClienteRef[];
  responsaveis: string[];
  editavel: boolean;
  onArrastar: (id: string | null) => void;
  onSoltarAntes: () => void;
  onAtualizar: (id: string, campos: Partial<Cartao>) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
  onMover: (id: string, colunaDestino: string, indice: number | null) => Promise<void>;
  onDefinirResponsaveis: (cartaoId: string, ids: string[]) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const [titulo, setTitulo] = useState(cartao.titulo);

  useEffect(() => {
    setTitulo(cartao.titulo);
  }, [cartao.titulo]);

  const cliente = clientes.find((c) => c.id === cartao.cliente_id);
  const equipe = membros.filter((m) => responsaveis.includes(m.id));

  const hoje = hojeISO();
  const atrasado = Boolean(cartao.prazo && cartao.prazo < hoje);
  const hojeMesmo = cartao.prazo === hoje;

  return (
    <div
      draggable={editavel}
      onDragStart={() => onArrastar(cartao.id)}
      onDragEnd={() => onArrastar(null)}
      onDragOver={(e) => {
        if (!editavel) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (!editavel) return;
        e.preventDefault();
        e.stopPropagation();
        onSoltarAntes();
      }}
      className="rounded-xl border border-border bg-background p-3 shadow-sm transition-shadow hover:shadow-card"
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="block w-full text-left text-sm font-medium text-ink"
      >
        {cartao.titulo}
      </button>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {cliente ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
            {cliente.nome}
          </span>
        ) : null}
        {cartao.prazo ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              atrasado
                ? "bg-destructive/10 text-destructive"
                : hojeMesmo
                  ? "bg-brand/10 text-brand"
                  : "bg-muted text-ink-muted"
            }`}
          >
            <CalendarDays className="size-3" />
            {new Date(`${cartao.prazo}T12:00:00`).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        ) : null}
        {equipe.length > 0 ? (
          <span className="ml-auto flex -space-x-1.5">
            {equipe.slice(0, 3).map((m) => (
              <span
                key={m.id}
                title={m.nome || m.email}
                className="grid size-6 place-items-center rounded-full border border-card bg-brand text-[10px] font-bold text-brand-foreground"
              >
                {iniciais(m.nome || m.email)}
              </span>
            ))}
            {equipe.length > 3 ? (
              <span className="grid size-6 place-items-center rounded-full border border-card bg-muted text-[10px] font-bold text-ink-muted">
                +{equipe.length - 3}
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      {aberto ? (
        <div className="mt-3 border-t border-border pt-3">
          {editavel ? (
            <>
              <label className="block">
                <span className="text-[11px] font-medium text-ink-muted">Título</span>
                <textarea
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  onBlur={() => {
                    const limpo = titulo.trim();
                    if (limpo && limpo !== cartao.titulo) void onAtualizar(cartao.id, { titulo: limpo });
                    else setTitulo(cartao.titulo);
                  }}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                />
              </label>

              <label className="mt-2 block">
                <span className="text-[11px] font-medium text-ink-muted">Cliente</span>
                <select
                  value={cartao.cliente_id ?? ""}
                  onChange={(e) =>
                    void onAtualizar(cartao.id, { cliente_id: e.target.value || null })
                  }
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                >
                  <option value="">Sem cliente</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-2 block">
                <span className="text-[11px] font-medium text-ink-muted">Prazo</span>
                <input
                  type="date"
                  value={cartao.prazo ?? ""}
                  onChange={(e) => void onAtualizar(cartao.id, { prazo: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                />
              </label>

              <div className="mt-2">
                <span className="text-[11px] font-medium text-ink-muted">Responsáveis</span>
                <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-input">
                  {membros.map((m) => {
                    const marcado = responsaveis.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          void onDefinirResponsaveis(
                            cartao.id,
                            marcado
                              ? responsaveis.filter((id) => id !== m.id)
                              : [...responsaveis, m.id],
                          )
                        }
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-muted"
                      >
                        <span
                          className={
                            marcado
                              ? "grid size-4 shrink-0 place-items-center rounded border border-brand bg-brand"
                              : "grid size-4 shrink-0 place-items-center rounded border border-input"
                          }
                        >
                          {marcado ? <Check className="size-3 text-brand-foreground" /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-ink">
                          {m.nome || m.email}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="mt-2 block">
                <span className="text-[11px] font-medium text-ink-muted">Mover para</span>
                <select
                  value={cartao.coluna_id}
                  onChange={(e) => void onMover(cartao.id, e.target.value, null)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-brand"
                >
                  {colunas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="text-xs font-medium text-ink-muted hover:text-ink"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => void onRemover(cartao.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Excluir
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-muted">
              {equipe.length > 0
                ? `Responsáveis: ${equipe.map((m) => m.nome || m.email).join(", ")}`
                : "Sem responsáveis."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
