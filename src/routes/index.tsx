import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { PeopleLogo } from "@/components/PeopleLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Portal do Cliente people" },
      {
        name: "description",
        content:
          "Acesse o Portal do Cliente people para acompanhar métricas, criativos e relatórios das suas campanhas.",
      },
      { property: "og:title", content: "Entrar — Portal do Cliente people" },
      {
        property: "og:description",
        content: "Portal do Cliente people: métricas e resultados das suas campanhas em um só lugar.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function redirecionarPorRole(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    navigate({ to: data?.role === "agencia" ? "/agencia" : "/cliente", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) void redirecionarPorRole(data.session.user.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setEnviando(true);

    if (modo === "criar") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: window.location.origin },
      });
      setEnviando(false);
      if (error) return setErro(error.message);
      if (!data.session) {
        setAviso("Conta criada! Confirme seu e-mail para acessar o portal.");
        setModo("entrar");
        return;
      }
      if (data.user) await redirecionarPorRole(data.user.id);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro("E-mail ou senha inválidos.");
    if (data.user) await redirecionarPorRole(data.user.id);
  }

  return (
    <main className="flex min-h-screen flex-col bg-shell">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm rounded-2xl bg-card p-7 shadow-card">
          <div className="flex justify-center">
            <PeopleLogo tone="light" size="lg" />
          </div>
          <h1 className="mt-6 text-center text-lg font-semibold text-ink">
            {modo === "entrar" ? "Portal do Cliente" : "Criar acesso"}
          </h1>
          <p className="mt-1 text-center text-sm text-ink-muted">
            Entre com seu e-mail e senha para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-ink">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
                placeholder="voce@empresa.com.br"
              />
            </div>
            <div>
              <label htmlFor="senha" className="text-sm font-medium text-ink">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                minLength={6}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand"
                placeholder="••••••••"
              />
            </div>

            {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
            {aviso ? <p className="text-sm font-medium text-success">{aviso}</p> : null}

            <button
              type="submit"
              disabled={enviando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand-hover disabled:opacity-70"
            >
              {enviando ? <Loader2 className="size-4 animate-spin" /> : null}
              {modo === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setModo(modo === "entrar" ? "criar" : "entrar");
              setErro(null);
              setAviso(null);
            }}
            className="mt-5 block w-full text-center text-xs font-medium text-ink-muted transition-colors hover:text-brand"
          >
            {modo === "entrar" ? "Primeiro acesso? Criar conta" : "Já tenho conta — entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}
