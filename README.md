# People Client Hub

# Portal do Cliente — People 

Crie um portal web (React + TypeScript + Tailwind + shadcn/ui) com autenticação

via Supabase, contendo DOIS tipos de acesso: **cliente** e **agência**.

Nesta primeira versão, implemente COMPLETAMENTE apenas a área do CLIENTE.

A área da agência deve existir apenas como rota protegida com uma página

placeholder ("Área da Agência — em configuração"), sem funcionalidades.

## 1. Identidade visual (obrigatório seguir)

Marca: **people** (logo em texto, minúsculo, fonte geométrica sem serifa tipo

Poppins/Montserrat, com o ícone de 3 figuras humanas em rosa antes da palavra).

Paleta:

- Fundo escuro / sidebar / topo: `#2E2E2E` (quase preto, cinza-carvão)

- Superfície escura secundária: `#3A3A3A`

- Cor de marca (destaque, botões, ícone do logo): `#F0245E` (rosa/magenta vibrante)

- Rosa hover: `#D81B50`

- Fundo da área de conteúdo (tema claro): `#EDEDF3` (cinza-lilás bem claro)

- Cards: branco `#FFFFFF`, radius 16px, sombra suave

- Texto principal: `#1A1A1A` no claro / `#FFFFFF` no escuro

- Texto secundário: `#6B6B76`

Suporte a **tema claro e escuro** com um toggle "Mudar tema" no topo.

No tema escuro tudo vira `#2E2E2E`/`#242424` mantendo o rosa como destaque.

Tipografia: Poppins (ou Inter como fallback). Títulos em semibold/bold.

## 2. Autenticação

- Tela de login única, centralizada, fundo `#2E2E2E`, card branco (ou escuro no

  dark mode) com o logo **people** no topo, campos e-mail/senha e botão rosa

  "Entrar".

- Tabela `profiles` no Supabase com: `id`, `nome`, `email`, `role`

  (`cliente` | `agencia`), `cliente_id`, `avatar_url`.

- Após login, redirecionar por role: `cliente` → `/cliente`, `agencia` → `/agencia`.

- Rotas protegidas com RLS ativo. Cliente NUNCA acessa rotas da agência.

## 3. Área do Cliente — Menu de seleção (tela principal)

Replique exatamente este estilo de menu (é o padrão visual do projeto):

**Topo (header):** barra fina com o logo **people** à esquerda e, à direita,

links discretos com ícone: "Mudar tema" e "Sair". Avatar/nome do usuário ao lado.

**Corpo:** fundo `#EDEDF3`, conteúdo centralizado com largura máx. ~720px:

- Linha pequena e cinza: `Bem-vindo(a) de volta, {primeiro nome}`

- Título grande em bold: `O que vamos analisar hoje?`

- Abaixo, uma **lista vertical de cards** (não grid), com espaçamento de 16px.

**Anatomia de cada card:**

- Card branco, radius 16px, padding 20px, borda 1px sutil colorida na mesma

  família da cor do ícone, e um leve tint de fundo dessa cor (~6% opacidade).

- À esquerda: quadrado com cantos arredondados (48x48px) com a cor sólida do

  card e um ícone branco (lucide-react) dentro.

- No meio: título em bold (16px) + eventual badge ao lado + descrição em cinza

  (14px, máx. 2 linhas com reticências).

- À direita: link `Acessar ›` em cinza escuro, com seta.

- Hover: leve elevação (shadow) + translateY(-2px), transição 150ms.

- Card inteiro é clicável.

**Cards desta versão:**

1. **Dashboard de Métricas** — ATIVO

   - Cor: roxo `#7C5CFF`, ícone `BarChart3`

   - Descrição: "Acompanhe os resultados das suas campanhas e o desempenho do

     seu investimento em tempo real."

   - Ação: navega para `/cliente/metricas`

2. Os demais cards abaixo devem aparecer no estado **"Em Breve"**:

   - **Criativos** — cor rosa `#F0245E`, ícone `Image`

   - **Relatórios** — cor teal `#2BB8A3`, ícone `FileText`

   - **Financeiro** — cor laranja `#F5A524`, ícone `Wallet`

   - **Suporte** — cor indigo `#5B6CFF`, ícone `MessageCircle`

**Estado "Em Breve" (importante):**

- O conteúdo do card (ícone, título, descrição) recebe `filter: blur(3px)` e

  `opacity: 0.55`, e `user-select: none`.

- Por cima, centralizado e SEM blur, um badge/pílula com fundo `#2E2E2E`,

  texto branco em bold, uppercase, letras espaçadas: **EM BREVE!**

- `cursor: not-allowed`, sem hover, card não clicável.

- Componente reutilizável: `<MenuCard comingSoon />`.

## 4. Área do Cliente — Dashboard de Métricas (`/cliente/metricas`)

- Mesmo header. Botão "‹ Voltar" para o menu.

- Título "Dashboard de Métricas" + seletor de período (Hoje, 7 dias, 30 dias,

  Mês atual, Personalizado).

- Linha de KPIs em cards brancos: Investimento, Impressões, Cliques, CTR,

  CPC, Leads, CPL, Conversões. Cada KPI mostra valor grande, rótulo em cinza e

  variação % vs. período anterior (verde/vermelho).

- Um gráfico de linha (Recharts) de Leads x Investimento ao longo do tempo.

- Uma tabela de campanhas com: nome, status, investimento, leads, CPL.

- **Use dados mockados realistas por enquanto**, isolados em `src/mocks/metrics.ts`,

  já preparados para depois virem do Supabase (crie a tabela `metricas_diarias`

  com `cliente_id`, `data`, `investimento`, `impressoes`, `cliques`, `leads`,

  `conversoes`).

- Cada cliente só enxerga os próprios dados (RLS por `cliente_id`).

## 5. Estrutura e qualidade

- Componentes reutilizáveis: `AppHeader`, `MenuCard`, `KpiCard`, `ThemeToggle`,

  `ProtectedRoute`.

- Cores centralizadas em tokens do Tailwind (`brand`, `surface`, `ink`), nada

  de hexadecimal solto nos componentes.

- Totalmente responsivo: no mobile os cards ocupam 100% da largura, header

  compacto, KPIs em 2 colunas.

- Textos da interface em **português do Brasil**.

Não implemente ainda nada da área da agência além do placeholder.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/49ab22c6-9f4e-438d-8948-4dc27f2c889f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
