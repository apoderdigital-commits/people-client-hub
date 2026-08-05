import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuCardColor = "violet" | "pink" | "teal" | "amber" | "indigo";

const cores: Record<MenuCardColor, { icone: string; borda: string; tint: string }> = {
  violet: { icone: "bg-card-violet", borda: "border-card-violet/30", tint: "bg-card-violet/6" },
  pink: { icone: "bg-card-pink", borda: "border-card-pink/30", tint: "bg-card-pink/6" },
  teal: { icone: "bg-card-teal", borda: "border-card-teal/30", tint: "bg-card-teal/6" },
  amber: { icone: "bg-card-amber", borda: "border-card-amber/30", tint: "bg-card-amber/6" },
  indigo: { icone: "bg-card-indigo", borda: "border-card-indigo/30", tint: "bg-card-indigo/6" },
};

type Props = {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  cor: MenuCardColor;
  badge?: string;
  to?: string;
  comingSoon?: boolean;
};

export function MenuCard({ titulo, descricao, icone: Icone, cor, badge, to, comingSoon }: Props) {
  const paleta = cores[cor];

  const conteudo = (
    <div className={cn("flex items-center gap-4", comingSoon && "coming-soon-blur")}>
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-xl", paleta.icone)}>
        <Icone className="size-6 text-brand-foreground" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-ink">{titulo}</h3>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{descricao}</p>
      </div>
      {!comingSoon ? (
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-ink/70 sm:inline-flex">
          Acessar
          <ChevronRight className="size-4" />
        </span>
      ) : null}
    </div>
  );

  const base = cn(
    "relative block w-full rounded-2xl border bg-card p-5 shadow-card transition-all duration-150",
    paleta.borda,
  );

  if (comingSoon) {
    return (
      <div className={cn(base, "cursor-not-allowed")} aria-disabled="true">
        <div className={cn("pointer-events-none absolute inset-0 rounded-2xl", paleta.tint)} />
        <div className="relative">{conteudo}</div>
        <div className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-shell px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-shell-foreground">
            Em breve!
          </span>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={to ?? "/"}
      className={cn(base, "hover:-translate-y-0.5 hover:shadow-card-hover")}
    >
      <div className={cn("pointer-events-none absolute inset-0 rounded-2xl", paleta.tint)} />
      <div className="relative">{conteudo}</div>
    </Link>
  );
}
