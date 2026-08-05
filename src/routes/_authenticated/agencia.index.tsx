import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, FileText, Megaphone, Users } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { MenuCard } from "@/components/MenuCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/_authenticated/agencia/")({
  head: () => ({
    meta: [
      { title: "Área da Agência — people" },
      {
        name: "description",
        content: "Painel interno da agência people: configure clientes e acompanhe as contas.",
      },
      { property: "og:title", content: "Área da Agência — people" },
      {
        property: "og:description",
        content: "Painel interno da agência people: configuração de clientes e gestão de contas.",
      },
    ],
  }),
  component: AgenciaMenu,
});

function AgenciaMenu() {
  return (
    <ProtectedRoute role="agencia">
      {(perfil) => (
        <div className="min-h-screen bg-background">
          <AppHeader perfil={perfil} />
          <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:py-14">
            <p className="text-sm text-ink-muted">
              Olá, {(perfil.nome || perfil.email).split(" ")[0]}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Área da Agência</h1>

            <div className="mt-7 flex flex-col gap-4">
              <MenuCard
                titulo="Configurar Clientes"
                descricao="Cadastre e ajuste as contas dos clientes, defina o identificador de cliente e o nível de acesso."
                icone={Users}
                cor="violet"
                badge="Ativo"
                to="/agencia/clientes"
              />
              <MenuCard
                comingSoon
                titulo="Campanhas"
                descricao="Gerencie campanhas e verbas de todos os clientes da carteira."
                icone={Megaphone}
                cor="pink"
              />
              <MenuCard
                comingSoon
                titulo="Métricas Consolidadas"
                descricao="Visão agregada de performance de toda a base de clientes."
                icone={BarChart3}
                cor="teal"
              />
              <MenuCard
                comingSoon
                titulo="Relatórios Internos"
                descricao="Relatórios operacionais e entregáveis do time."
                icone={FileText}
                cor="amber"
              />
            </div>
          </main>
        </div>
      )}
    </ProtectedRoute>
  );
}
