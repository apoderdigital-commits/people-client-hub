-- Configuração de métricas por cliente.
--
-- `metricas_kpis` guarda a lista ordenada de indicadores que o dashboard
-- mostra. `acao_lead` e `acao_conversao` (já existentes) dizem qual action_type
-- da Meta conta como lead e como conversão — aplicados na leitura, sobre o
-- jsonb `acoes`, de modo que trocar a escolha recalcula todo o histórico já
-- importado sem nova chamada à Meta.

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS metricas_kpis jsonb;

-- O dashboard do próprio cliente precisa ler essa configuração, e hoje só a
-- equipe enxerga a tabela. A policy libera exclusivamente a própria linha.
DROP POLICY IF EXISTS "cliente ve seu proprio cliente" ON public.clientes;
CREATE POLICY "cliente ve seu proprio cliente" ON public.clientes
  FOR SELECT TO authenticated
  USING (id = public.current_cliente_id());
