# Arquitetura

Visão de como o MVP é montado e por quê. As decisões estão em [memorias/decisoes.md](../memorias/decisoes.md) (D-013 a D-018).

## Camadas

```
 PWA (React)  ──HTTP/JSON──▶  API (Fastify)  ──Kysely──▶  SQLite  (trocável por PostgreSQL)
      │                          │      │
      └── @role/contracts ◀──────┘      └──▶ FileStorage (disco, trocável por S3)
              │                                 
              └── @role/domain (regras puras: quórum, permissões, sorteio, rateio)
```

| Camada | Responsabilidade | Não faz |
|---|---|---|
| `packages/domain` | Regras de negócio puras (sem I/O): `evaluateQuorum`, `can`, `drawRoles`, `computeSettlement`, `simplifyDebts` | Banco, rede, relógio |
| `packages/contracts` | Esquemas Zod das entradas e tipos das respostas | Lógica de negócio |
| `apps/api` rotas | Autenticar, validar entrada, chamar o serviço, devolver DTO | Regra de negócio |
| `apps/api` serviços | Orquestrar: transação, permissão, notificações, auditoria, agendamento de jobs | SQL espalhado fora de serviços e queries |
| `apps/web` | Telas, estado do servidor (TanStack Query), formatação | Decidir permissão (só reflete `me.can`) |

## Modelo de dados (resumo)

- **users**, **otp_codes**: identidade por telefone.
- **events**: cartão da proposta, status (`open`, `confirmed`, `archived`, `cancelled`, `closed`), configuração do sinal, mural da Base.
- **participations**: resposta (`in`/`out`), preferências de consumo e status do sinal. Única por (evento, usuário).
- **event_roles** (um ocupante por cargo), **role_declines** (quem recusou o sorteio).
- **deposit_proofs**: histórico de comprovantes; o último vale.
- **expenses**, **expense_participants** (cota custom), **expense_contests** (uma por despesa).
- **settlements**, **settlement_balances**, **settlement_transfers**: foto auditável do fechamento.
- **supply_items** (lista de mercado, com vínculo opcional à despesa gerada), **vehicles**, **vehicle_passengers** (um lugar por pessoa por rolê) e **cargo_items** (bagagem por carro).
- **notifications** (com chave de deduplicação), **event_mutes**.
- **jobs**: agendamentos que sobrevivem a reinícios. **audit_log**: trilha de quem fez o quê.

Convenções: ids UUID em TEXT; datas ISO-8601 UTC em TEXT; dinheiro em centavos inteiros (INTEGER); booleanos 0/1. Tudo portável para PostgreSQL.

## Fluxos que merecem atenção

**Massa crítica.** Cada resposta roda numa transação: grava a participação, conta os confirmados, chama `evaluateQuorum` e, se o quórum fechou, confirma o rolê, notifica, agenda o alerta de cargo vago e abre a Janela do Sinal. Resposta repetida é no-op. Como o SQLite serializa as transações em uma única conexão, duas confirmações simultâneas não geram estado inconsistente.

**Prazos e lembretes.** Em vez de timers em memória, cada prazo vira uma linha em `jobs` (idempotente por `dedupe_key`). O runner reivindica cada job com um `UPDATE` condicional, executa e marca como feito; falhas voltam à fila com espera exponencial (3 tentativas). Os handlers **revalidam o estado** ao rodar, então prazo estendido ou rolê cancelado viram no-ops. Além disso, os pontos de leitura (convite, feed, resposta) expiram propostas vencidas sob demanda, para a tela nunca mostrar proposta viva com prazo vencido.

**Rateio.** `computeSettlement` recebe o roster, as despesas aprovadas, os sinais aprovados e o Tesoureiro. Para cada despesa resolve os beneficiários pela cota, divide em centavos (resto para o Tesoureiro), registra o sinal como crédito de quem pagou e dívida do Tesoureiro, e devolve saldos e transferências. O teste de invariante roda 200 cenários aleatórios: a soma dos saldos é zero e as transferências zeram todo mundo.

**Permissões.** `can(actor, action)` é a única fonte da matriz. O servidor chama em cada operação; a API devolve `me.can` para o front esconder o que não cabe. Os cargos Base e Tesouro têm fallback no Idealizador enquanto vagos.

**Arquivos.** Comprovantes e notas ficam fora de qualquer pasta pública. O nome vem do servidor (UUID), o tipo é detectado pelo conteúdo (JPG, PNG, WebP, PDF), o tamanho é limitado a 5 MB e o download exige sessão e permissão, com `nosniff` e sem cache.

## Segurança

- Sessão por JWT em cookie `httpOnly` + `SameSite=Lax` (+ `Secure` em produção). Mutações exigem JSON ou multipart, e o `Lax` bloqueia POST de outros sites.
- OTP guardado só como HMAC, com validade de 10 minutos, 5 tentativas e limite de pedidos por telefone, além de limite por IP nas rotas de login.
- Helmet, rate limit global, validação de toda entrada com Zod, erros padronizados sem vazar detalhes internos, logs com cookies redigidos.
- Autorização por papel no servidor em todos os endpoints de rolê; o convite é o único recurso público (somente leitura).
- O service worker do PWA só guarda o "casco" do app; `/api` nunca entra em cache.

## Design

Direção "ordem de missão" (D-019). Tokens de cor, tipografia e os componentes de assinatura (`.ticket`, `.stamp`, `.key`, `.slot-in`) estão em `apps/web/src/styles.css`; os componentes React em `features/events/shared.tsx` (`Ticket`, `Stamp`, `SwallowMeter`) e `components/icons.tsx`. O modo escuro troca só os valores dos tokens. Animações respeitam `prefers-reduced-motion`.

## Limites conhecidos do MVP

- **Uma única instância** da API (SQLite e runner de jobs em processo). Para escalar: PostgreSQL, `started_at` nos jobs e `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Prévia do link** usa uma única imagem para todos os rolês (a rota `/share/:code` já entrega o texto). Em produção, `/share` e `/api` precisam estar na mesma origem do app.
- **Previsão do tempo** é chamada do navegador ao Open-Meteo; a política de segurança do site precisa liberar os dois domínios (D-021).
- **Notificações só dentro do app.** A tabela `notifications` já serve de fila de saída para push, e-mail e WhatsApp.
- **Login por OTP sem provedor real** em produção (interface `OtpSender` pronta).
- **Sem testes de interface automatizados** (o fluxo é coberto por testes de API; a interface foi verificada manualmente em visual mobile).
- **Teto de despesa e de cargos fixos** (R$ 300 e 2): colunas já existem por rolê, falta a tela.
- **Ordem de criação em empate de milissegundo** (carros, itens): a lista usa `created_at`; só os testes, com relógio fixo, expõem empates.

## Como evoluir

| Quero... | Onde mexer |
|---|---|
| Nova regra de dinheiro, quórum ou permissão | `packages/domain` + teste + `memorias/regras-de-negocio.md` |
| Novo campo ou endpoint | schema em `packages/contracts`, migration, serviço e rota |
| Trocar para PostgreSQL | dialeto em `db/client.ts`, tipos `INTEGER`/`TEXT` das migrations, `onConflict` já é portável |
| Guardar arquivos em S3 | nova classe que implementa `FileStorage` |
| Enviar SMS/WhatsApp | nova classe que implementa `OtpSender` e um consumidor da tabela `notifications` |
| Novo módulo do QG | pasta em `apps/api/src/modules`, tabela em nova migration, ação em `packages/domain/permissions.ts`, aba em `features/hq` |
