import { Navigate, useNavigate } from "@tanstack/react-router";
import { Eye, X } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { Perfil } from "@/hooks/use-auth";
import { limparClienteSelecionado, useClienteSelecionado } from "@/lib/visao-cliente";

/**
 * Para a agência: exige um cliente selecionado antes de mostrar a área do cliente.
 * Para o cliente: não interfere (o acesso já é o dele).
 */
export function VisaoClienteGate({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const { cliente, pronto } = useClienteSelecionado();

  if (perfil.role !== "agencia") return <>{children}</>;

  if (!pronto) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!cliente) return <Navigate to="/agencia/visualizar" replace />;

  return <>{children}</>;
}

/** Faixa indicando qual cliente a agência está visualizando. */
export function VisaoClienteBanner({ perfil }: { perfil: Perfil }) {
  const navigate = useNavigate();
  const { cliente } = useClienteSelecionado();

  if (perfil.role !== "agencia" || !cliente) return null;

  return (
    <div className="border-b border-border bg-muted">
      <div className="mx-auto flex w-full max-w-[720px] items-center gap-2 px-4 py-2 text-sm">
        <Eye className="size-4 shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1 truncate text-ink-muted">
          Visualizando como <span className="font-semibold text-ink">{cliente.nome}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            limparClienteSelecionado();
            navigate({ to: "/agencia/visualizar", replace: true });
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-card hover:text-ink"
        >
          <X className="size-3.5" />
          Trocar cliente
        </button>
      </div>
    </div>
  );
}
