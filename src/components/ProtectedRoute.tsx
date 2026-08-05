import type { ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth, type Perfil } from "@/hooks/use-auth";

type Props = {
  role: "cliente" | "agencia";
  children: (perfil: Perfil) => ReactNode;
};

/** Garante sessão ativa e o papel correto antes de renderizar a área. */
export function ProtectedRoute({ role, children }: Props) {
  const { session, perfil, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  if (!session) return <Navigate to="/" replace />;
  if (!perfil) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <p className="text-sm text-ink-muted">Perfil não encontrado. Fale com a agência.</p>
      </div>
    );
  }
  if (perfil.role !== role) {
    return <Navigate to={perfil.role === "agencia" ? "/agencia" : "/cliente"} replace />;
  }

  return <>{children(perfil)}</>;
}
