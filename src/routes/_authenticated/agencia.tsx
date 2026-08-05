import { createFileRoute } from "@tanstack/react-router";
import { Settings2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/_authenticated/agencia")({
  head: () => ({
    meta: [
      { title: "Área da Agência — people" },
      { name: "description", content: "Painel interno da agência people, em configuração." },
      { property: "og:title", content: "Área da Agência — people" },
      { property: "og:description", content: "Painel interno da agência people, em configuração." },
    ],
  }),
  component: AgenciaPage,
});

function AgenciaPage() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto grid w-full max-w-[720px] place-items-center px-4 py-20">
            <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-card">
              <span className="mx-auto grid size-12 place-items-center rounded-xl bg-brand">
                <Settings2 className="size-6 text-brand-foreground" />
              </span>
              <h1 className="mt-4 text-xl font-bold text-ink">Área da Agência — em configuração</h1>
              <p className="mt-2 text-sm text-ink-muted">
                As funcionalidades desta área serão liberadas em breve.
              </p>
            </div>
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}
