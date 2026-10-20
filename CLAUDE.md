# Operação Rolê: instruções do projeto

App de organização de rolês em grupo (PWA + API). Idioma de trabalho e de interface: **português do Brasil**.

## Comandos

- `npm run dev`: API (:3333) e app (:5173). `npm run check`: typecheck + lint + testes (rode antes de dar algo por pronto).
- `npm test -w @role/api`: testes de integração da API (relógio falso, SQLite em memória).
- `npm run db:seed`: dados de demonstração (telefones `(11) 99999-0001` a `0005`).

## Arquitetura em uma frase

`packages/domain` (regras puras) e `packages/contracts` (Zod + DTOs) são usados por `apps/api` (Fastify + Kysely + SQLite) e `apps/web` (React + Vite + Tailwind + TanStack Query). Detalhes: `docs/arquitetura.md`.

## Regras de código

- **Dinheiro é inteiro em centavos**, sempre. Nunca `float`. Datas em ISO-8601 UTC.
- **Regra de negócio vive em `packages/domain`** (função pura + teste). A API orquestra; as rotas são finas (validam com Zod de `@role/contracts`, chamam um serviço).
- **Permissão é checada no servidor** com `can()` do domínio; o front só reflete `me.can`.
- Mudou comportamento de dinheiro, quórum ou permissão? Atualize o teste (inclusive o de invariante: soma dos saldos = 0).
- Mudou o banco? Nova migration em `apps/api/src/db/migrations` e registro em `migrate.ts`. Não edite migration já aplicada.
- Novas mensagens ao usuário em pt-BR, tom leve e impessoal ("Chato Oficial"), sem expor devedor ao grupo.
- Evite `any` (exceto em testes). TypeScript estrito está ligado.

## Cérebro do app

A pasta `memorias/` é a memória viva do projeto. Ao começar uma sessão, leia `memorias/INDEX.md`.

Durante o trabalho, mantenha-a atualizada sem precisar ser lembrado:
- **Decisão tomada** → nova entrada em `memorias/decisoes.md` (formato ADR curto: contexto, decisão, consequências, data) e, se havia questão aberta, mova-a em `memorias/questoes-abertas.md`.
- **Regra de negócio criada ou alterada** → `memorias/regras-de-negocio.md`, o código em `packages/domain`, o teste e o ticket em `docs/BACKLOG.md`.
- **Termo novo** → `memorias/glossario.md`.
- **Aprendizado de usuário, teste ou erro** → `memorias/aprendizados.md`.
- Atualize a data de "última atualização" no `INDEX.md` e o status dos tickets no backlog.

Não duplique conteúdo: o PRD descreve o produto, `memorias/` guarda o que foi decidido e por quê. Em caso de conflito, `memorias/` vence, pois é mais recente.

## Convenções

- Tickets: `ROL-NNN`. Prioridades P0/P1/P2. Status no fim do título no backlog.
- Questões em aberto: `Q1`, `Q2`... Decisões: `D-001`, `D-002`... Regras: `RN-01`...
- **O app não custodia dinheiro** (princípio inegociável; D-003). Qualquer ideia que mova dinheiro dentro do app exige parecer jurídico antes.
- Não lance publicamente sem fechar: parecer jurídico (Q12), provedor de OTP (Q11), LGPD (ROL-121) e termos de uso (ROL-123).
