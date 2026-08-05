import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  rotulo: string;
  valor: string;
  variacao: number;
  /** true quando aumentar é ruim (ex.: CPC, CPL) */
  inverso?: boolean;
};

export function KpiCard({ rotulo, valor, variacao, inverso }: Props) {
  const positivo = inverso ? variacao <= 0 : variacao >= 0;
  const Icone = variacao >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="truncate text-xs font-medium uppercase tracking-wide text-ink-muted">
        {rotulo}
      </p>
      <p className="mt-2 text-2xl font-bold text-ink">{valor}</p>
      <p
        className={cn(
          "mt-1 inline-flex items-center gap-1 text-xs font-semibold",
          positivo ? "text-success" : "text-destructive",
        )}
      >
        <Icone className="size-3.5" />
        {Math.abs(variacao).toFixed(1)}%
        <span className="font-normal text-ink-muted">vs. período anterior</span>
      </p>
    </div>
  );
}
