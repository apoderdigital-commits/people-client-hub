import { useEffect, useState } from "react";

const CHAVE = "people:cliente-visualizando";

/**
 * A empresa que a agência escolheu visualizar — uma linha de `clientes`, não
 * uma conta de login. São coisas distintas: `clientes` é a empresa gerida
 * (conta de anúncio, metas), enquanto `profiles` guarda quem faz login.
 */
export type ClienteSelecionado = {
  cliente_id: string;
  nome: string;
  identificador: string;
};

export function definirClienteSelecionado(cliente: ClienteSelecionado) {
  localStorage.setItem(CHAVE, JSON.stringify(cliente));
}

export function limparClienteSelecionado() {
  localStorage.removeItem(CHAVE);
}

export function lerClienteSelecionado(): ClienteSelecionado | null {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as Partial<ClienteSelecionado>;
    // Seleções gravadas no formato antigo (conta de login) são descartadas:
    // quem estiver com uma delas simplesmente escolhe de novo.
    if (typeof dado.cliente_id !== "string" || dado.cliente_id === "") return null;
    return {
      cliente_id: dado.cliente_id,
      nome: dado.nome ?? "",
      identificador: dado.identificador ?? "",
    };
  } catch {
    return null;
  }
}

/** Cliente que a agência escolheu visualizar (null para o próprio cliente). */
export function useClienteSelecionado() {
  const [cliente, setCliente] = useState<ClienteSelecionado | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    setCliente(lerClienteSelecionado());
    setPronto(true);
  }, []);

  return { cliente, pronto };
}
