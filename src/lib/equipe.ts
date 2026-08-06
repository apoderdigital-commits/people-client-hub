/** Níveis de acesso e permissões por aba do time people. */

export type EquipeRole =
  | "super_admin"
  | "admin"
  | "gestor_trafego"
  | "social_media"
  | "gerente_projeto"
  | "designer"
  | "editor_video"
  | "gestor"
  | "analista";

export const NIVEIS: { valor: EquipeRole; label: string }[] = [
  { valor: "super_admin", label: "Super admin" },
  { valor: "admin", label: "Admin" },
  { valor: "gestor_trafego", label: "Gestor de tráfego" },
  { valor: "social_media", label: "Social media" },
  { valor: "gerente_projeto", label: "Gerente de projeto" },
  { valor: "designer", label: "Designer" },
  { valor: "editor_video", label: "Editor de vídeo" },
];

/** Níveis legados mantidos apenas para exibição de contas antigas. */
export const NIVEIS_LEGADOS: { valor: EquipeRole; label: string }[] = [
  { valor: "gestor", label: "Gestor (legado)" },
  { valor: "analista", label: "Analista (legado)" },
];

export function rotuloNivel(nivel: EquipeRole | null): string {
  if (!nivel) return "—";
  return (
    [...NIVEIS, ...NIVEIS_LEGADOS].find((n) => n.valor === nivel)?.label ?? nivel
  );
}

export function ehAdminEquipe(nivel: EquipeRole | null): boolean {
  return nivel === "super_admin" || nivel === "admin";
}

/** Super admin cria qualquer nível; admin cria apenas de admin para baixo (exclui admin). */
export function niveisQuePodeConceder(nivel: EquipeRole | null): typeof NIVEIS {
  if (nivel === "super_admin") return NIVEIS;
  if (nivel === "admin") return NIVEIS.filter((n) => n.valor !== "super_admin" && n.valor !== "admin");
  return [];
}

export type NivelVisualizacao = "nenhum" | "ver" | "editar";

export const ABAS: { chave: string; label: string }[] = [
  { chave: "clientes", label: "Clientes" },
  { chave: "equipe", label: "Equipe" },
  { chave: "area_cliente", label: "Área do Cliente" },
  { chave: "fluxo", label: "Fluxo People" },
  { chave: "metricas", label: "Métricas" },
  { chave: "campanhas", label: "Campanhas" },
  { chave: "relatorios", label: "Relatórios" },
];

export type Permissoes = Record<string, NivelVisualizacao>;

export function lerPermissoes(valor: unknown): Permissoes {
  const base: Permissoes = {};
  for (const aba of ABAS) base[aba.chave] = "nenhum";
  if (valor && typeof valor === "object" && !Array.isArray(valor)) {
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      if (v === "ver" || v === "editar" || v === "nenhum") base[chave] = v;
    }
  }
  return base;
}

/** Super admin e admin sempre têm acesso total, independente do que estiver salvo. */
export function permissoesEfetivas(nivel: EquipeRole | null, valor: unknown): Permissoes {
  if (ehAdminEquipe(nivel)) {
    const todas: Permissoes = {};
    for (const aba of ABAS) todas[aba.chave] = "editar";
    return todas;
  }
  return lerPermissoes(valor);
}

export function podeVer(permissoes: Permissoes, chave: string): boolean {
  return permissoes[chave] === "ver" || permissoes[chave] === "editar";
}

export function podeEditar(permissoes: Permissoes, chave: string): boolean {
  return permissoes[chave] === "editar";
}
