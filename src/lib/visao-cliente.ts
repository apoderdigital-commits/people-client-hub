import { useEffect, useState } from "react";

const CHAVE = "people:cliente-visualizando";

export type ClienteSelecionado = {
  id: string;
  nome: string;
  email: string;
  cliente_id: string | null;
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
    return bruto ? (JSON.parse(bruto) as ClienteSelecionado) : null;
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
