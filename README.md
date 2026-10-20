# Operação Rolê

App que transforma "vamos marcar algo?" em rolê confirmado: decisão em grupo por **massa crítica** (as 3 andorinhas), tarefas divididas por **patentes** e contas fechadas com **rateio justo**, sem depender de unanimidade nem de discussão infinita no WhatsApp.

**Estado atual:** Funcionando de ponta a ponta: convite, quórum, cargos, sinal por Pix, despesas, rateio, acerto de contas, lista de mercado, carros e caronas, orçamento e previsão do tempo. Ainda **não validado com usuários** e **não pronto para lançamento público** (ver "Antes de lançar").

## Como rodar

Pré-requisito: Node 22 ou superior (testado no 24).

```bash
npm install
cp .env.example apps/api/.env   # já existe uma cópia de desenvolvimento em apps/api/.env
npm run db:seed                  # opcional: dados de demonstração
npm run dev                      # API em :3333 e app em http://localhost:5173
```

Entre com qualquer telefone do seed, por exemplo `(11) 99999-0001` (Ana, Idealizadora e Tesoureira do rolê de Ubatuba), com a senha `role-demo-2026`. Também dá para criar uma conta nova na tela de entrada. Para abrir no celular, use o IP da sua máquina na porta 5173.

| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe API e app com recarga automática |
| `npm test` | 148 testes (domínio, contratos, API de ponta a ponta e utilitários do app) |
| `npm run typecheck` | TypeScript estrito em todos os pacotes |
| `npm run lint` / `npm run format` | ESLint e Prettier |
| `npm run check` | Typecheck + lint + testes (rode antes de enviar mudanças) |
| `npm run build` | Build de produção da API (bundle em `apps/api/dist`) e do app (`apps/web/dist`, com PWA) |
| `npm run db:migrate` / `npm run db:seed` | Migrations e dados de demonstração |
| `npm run metrics` | Indicadores do PRD (G1 a G5) calculados do banco, com as metas ao lado (`-- --json` para máquinas) |
| `npm start` | Sobe a API em produção servindo o app já compilado (rode `npm run build` antes) |

## Colocar no ar

Um processo só serve o app e a API na mesma origem (cookie, prévia de link e PWA funcionam sem proxy):

```bash
npm ci && npm run build
NODE_ENV=production SESSION_SECRET=<32+ caracteres aleatórios> PUBLIC_WEB_URL=https://seu-dominio \
  DATABASE_PATH=/dados/role.db UPLOAD_DIR=/dados/uploads npm start
```

Há também um `Dockerfile` (imagem única, volume em `/data`). Ele **ainda não foi executado**: não havia Docker no ambiente. O CI (`.github/workflows/ci.yml`) roda tipos, lint, testes e build. Use HTTPS na frente (o cookie de sessão é `Secure` em produção) e faça cópia de segurança de `DATABASE_PATH` e `UPLOAD_DIR`.

## Estrutura

```
operacao-role/
├── apps/
│   ├── api/                 API Fastify (TypeScript)
│   │   └── src/
│   │       ├── modules/     um módulo por assunto: auth, events, roles, deposits,
│   │       │                expenses, settlement, notifications, jobs
│   │       │                (cada um: *.routes.ts finas + *.service.ts com a regra)
│   │       ├── db/          schema, migrations, cliente Kysely, seed
│   │       ├── lib/         armazenamento de arquivos, auditoria, formatação
│   │       └── test/        testes de integração (fluxo completo, com relógio falso)
│   └── web/                 PWA React + Vite + Tailwind
│       └── src/
│           ├── app/         rotas e casca (navegação inferior)
│           ├── features/    auth, feed, events (convite, criação), hq (QG), notifications
│           ├── components/  design system (Button, Sheet, Toast, campos...)
│           └── lib/         cliente HTTP, hooks de dados (TanStack Query), formatação
├── packages/
│   ├── domain/              regras puras, sem I/O: quórum, permissões, sorteio, rateio
│   └── contracts/           esquemas Zod de entrada e tipos de resposta da API
├── docs/                    PRD, backlog e arquitetura
└── memorias/                cérebro do app: decisões, regras, glossário, questões, aprendizados
```

Por que assim: as regras que mexem com dinheiro e permissão ficam em `packages/domain`, testáveis sem banco nem rede (inclusive com teste de invariante: a soma dos saldos é sempre zero). A API só orquestra e persiste. O mesmo esquema Zod valida o servidor e tipa o front.

## O que o MVP faz

1. **Proposta relâmpago:** cartão fechado (destino, data, teto por pessoa, prazo, quórum de 2 a 6).
2. **Massa crítica:** ao atingir o quórum, o rolê vira oficial e a turma é avisada. Sem quórum no prazo, a proposta é arquivada.
3. **Convite público por link:** abre sem login (modo Observador) e converte em "Tô dentro" com cadastro em 20 segundos (celular e senha; a tela mostra o rolê para o qual a pessoa foi chamada).
4. **Cargos:** Base, Frota, Suprimentos e Tesouro, por voluntariado ou sorteio. O Idealizador cobre Base e Tesouro enquanto vagos.
5. **Sinal por Pix (opcional):** janela com prazo, comprovante, aprovação do Tesoureiro, fila de espera automática.
6. **QG do rolê** com cinco abas: Base (Wi-Fi, endereço, previsão do tempo e simulador de orçamento), Equipe, Mercado, Frotas e Cofre.
7. **Despesas e rateio:** cotas global, etílica, carne, vegetariana e por pessoas específicas; aprovação acima do limite; contestação em 72h; fechamento com o mínimo de transferências; baixa pelo credor.
8. **"Chato Oficial":** avisos dentro do app para quórum, sinal, missão pendente e cobrança, sempre em privado e com silenciamento por rolê.

9. **Mercado & Itens:** lista sugerida por pessoas, consumo e dias; "eu levo"; baixa que vira despesa com a cota certa.
10. **Frotas & Caronas:** carros com lugares estilo mapa de avião, bagagem por carro e trava de sinal para escolher lugar.
11. **Orçamento e clima:** valor por pessoa caindo conforme entra gente, e previsão do tempo para os dias do rolê.
12. **Central da conta:** dados pessoais, escolha dos avisos por categoria, segurança (trocar senha, código de recuperação, aparelhos conectados) e privacidade (exportar e excluir).
13. **Quartos:** o General da Base monta os quartos e cada confirmado pega a própria cama, com a trava do sinal.
14. **Tudo interno:** sem SMS, WhatsApp ou e-mail. O acesso é celular + senha com código de recuperação, e os avisos vivem na aba Avisos.

Ficam para depois: guia do entorno, distribuição de quartos, OCR de notas e conciliação de Pix. Detalhes em [docs/BACKLOG.md](docs/BACKLOG.md).

## Antes de lançar

- **Parecer jurídico** sobre registrar sinais por Pix (Q12 / ROL-004) e **revisão dos termos de uso e da privacidade** (ROL-123): os textos em `/termos` e `/privacidade` são rascunhos, com contatos "a definir".
- **Validar com pessoas reais:** nenhuma meta do PRD foi testada ainda (ROL-001, ROL-124).
- Analytics de produto (ROL-013) e pipeline de CI (ROL-010).
- **Sem canal externo:** quem esquece a senha e perde o código de recuperação não tem como recuperar a conta; quem não abre o app não recebe lembretes (push, e-mail e WhatsApp ficam para depois).

## Mapa da pasta de documentação

| Arquivo | O que é |
|---|---|
| [docs/PRD-Operacao-Role.md](docs/PRD-Operacao-Role.md) | Requisitos, métricas, riscos |
| [docs/BACKLOG.md](docs/BACKLOG.md) | 70 tickets com status por ticket |
| [docs/arquitetura.md](docs/arquitetura.md) | Como o sistema é montado e por quê |
| [memorias/](memorias/INDEX.md) | Decisões (D-xxx), regras (RN-xx), glossário, questões abertas, aprendizados |
| [CLAUDE.md](CLAUDE.md) | Instruções para o Claude manter o cérebro atualizado |

## Como trabalhar neste projeto

1. Leia [memorias/INDEX.md](memorias/INDEX.md) antes de qualquer tarefa.
2. Decidiu algo? Registre em [memorias/decisoes.md](memorias/decisoes.md) e tire a questão de [memorias/questoes-abertas.md](memorias/questoes-abertas.md).
3. Mudou uma regra? Atualize [memorias/regras-de-negocio.md](memorias/regras-de-negocio.md), o código em `packages/domain` e o teste correspondente.
4. Aprendeu algo com usuários ou testes? Registre em [memorias/aprendizados.md](memorias/aprendizados.md).
5. Termos novos entram no [glossário](memorias/glossario.md). Status de tickets no [backlog](docs/BACKLOG.md).
