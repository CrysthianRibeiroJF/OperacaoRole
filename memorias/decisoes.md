# Registro de decisões

Formato: **ID · título · data · status** → contexto, decisão, consequências. Decisões não são apagadas: se mudarem, marque como `Substituída por D-0XX`.

---

## D-001 · Massa crítica em vez de unanimidade · 20/10/2026 · Aceita
**Contexto:** esperar todos confirmarem mata o rolê.
**Decisão:** um rolê vira "Confirmado" quando atinge o quórum mínimo (padrão 3), contando o Idealizador como primeiro voto.
**Consequências:** o quórum é parâmetro configurável (faixa 2–6). Risco de rolê "pequeno demais" mitigado exibindo o custo por pessoa com o N atual.

## D-002 · Proposta é um cartão fechado · 20/10/2026 · Aceita
**Contexto:** perguntas abertas geram debate infinito.
**Decisão:** a proposta tem campos obrigatórios fixos (destino, data, teto de gasto por pessoa, prazo). Sem publicação com campo vazio.
**Consequências:** o formulário precisa ser criável em ≤ 2 min.

## D-003 · O app não custodia dinheiro · 20/10/2026 · Aceita (sujeita a parecer jurídico, Q2)
**Contexto:** custodiar fundos implica regulação financeira.
**Decisão:** o app mostra a chave Pix e registra comprovantes; os pagamentos acontecem entre pessoas, fora do app.
**Consequências:** validação de comprovante é humana (Tesoureiro). Conciliação automática fica para P2.

## D-004 · Convite por link, web primeiro (PWA) · 20/10/2026 · Aceita (confirmada por D-013)
**Contexto:** o fluxo nasce no WhatsApp; exigir instalação derruba a conversão.
**Decisão:** PWA; convidados abrem o link sem instalar.
**Consequências:** push no iOS é limitado, então são necessários canais de fallback (Q7).

## D-005 · Cobrança é privada · 20/10/2026 · Aceita
**Contexto:** o "Chato Oficial" cobra no lugar do organizador, mas expor devedor desgasta a amizade.
**Decisão:** lembretes vão só ao devedor; o grupo vê no máximo o status agregado.
**Consequências:** a lista de devedores é visível só ao Tesoureiro e ao próprio devedor (Q6 sugere confirmar isso).

## D-006 · MVP enxuto: proposta → quórum → sinal → acerto de contas · 20/10/2026 · Aceita
**Contexto:** a tese central é decisão e dinheiro, não logística.
**Decisão:** frotas, mercado detalhado, clima e guia do entorno ficam para a Fase 2 ou depois.
**Consequências:** a cota de Veículo entra no MVP como lançamento manual até existir o módulo de frotas.

## D-007 · Despesas são lançamentos auditáveis com "quem participa" por item · 20/10/2026 · Aceita
**Contexto:** o rateio por perfil (global, etílica, carnívora, veículo) precisa ser justo e explicável.
**Decisão:** cada despesa define seus participantes; saldos são sempre derivados dos lançamentos.
**Consequências:** invariante testável (soma dos saldos = 0) e tela de auditoria. Suporta P1/P2 sem migração.

## D-008 · "Confirmado" ≠ "Confirmado com sinal pago" · 20/10/2026 · Aceita
**Contexto:** o plano original mistura destravar o rolê com garantir a vaga.
**Decisão:** o primeiro estado destrava o rolê; o segundo dá direito a escolher cama/vaga no carro.
**Consequências:** a lista de espera se baseia no segundo estado.

---

## Decisões de 20/10/2026 (respostas a Q1–Q5, delegadas ao Claude pelo usuário)

## D-009 · Sinal é opcional por rolê (Q1) · 20/10/2026 · Aceita
**Contexto:** rolê de bate e volta não tem reserva; exigir sinal criaria atrito sem ganho.
**Decisão:** o Idealizador liga o sinal ao criar o rolê, ou o Tesoureiro liga depois. A Janela do Sinal só abre quando o rolê é **confirmado** e a configuração está completa (valor + chave Pix). Prazo padrão de 48h. Depois que a janela abre, o valor não muda e o sinal não pode ser desligado.
**Consequências:** quem entra com a janela aberta nasce "pendente" (ou "na fila", se o prazo já passou). Quem sai depois de pagar gera aviso ao Tesoureiro para combinar a devolução fora do app.

## D-010 · Sem custódia de dinheiro, com parecer jurídico ainda pendente (Q2) · 20/10/2026 · Aceita provisoriamente
**Contexto:** a pergunta é jurídica e o Claude não pode resolvê-la.
**Decisão:** o MVP segue a premissa de D-003 (o app só mostra a chave Pix e registra comprovantes). O cancelamento após sinal pago gera apenas **orientação** ("combine a devolução com o Tesoureiro"). **Isto não substitui o parecer jurídico (ROL-004)**, que continua pendente antes de qualquer lançamento público.
**Consequências:** nada no app promete reembolso. Termos de uso (ROL-123) dependem do parecer.

## D-011 · Rolê confirmado nunca "desconfirma" (Q3) · 20/10/2026 · Aceita
**Decisão:** se, depois de confirmado, o número cair abaixo do quórum, o rolê segue confirmado e o Idealizador recebe um alerta (no máximo 1 por dia). A tela mostra "abaixo do mínimo".
**Consequências:** evita o efeito dominó de desistências e preserva quem já pagou sinal. O Idealizador decide se cancela.

## D-012 · Sorteio de cargos (Q4) · 20/10/2026 · Aceita
**Decisão:** o Idealizador sorteia só os cargos **vagos**, entre os confirmados. Cada pessoa tem teto de **2 cargos** por rolê. Quem recebe um cargo sorteado pode largá-lo, e **não é sorteado de novo para aquele cargo**. Assumir voluntariamente continua livre (respeitando o teto). Cargos só abrem com o rolê confirmado.
**Consequências:** o sorteio distribui a carga (prioriza quem tem menos cargos). O teto é fixo no MVP (coluna `max_roles_per_user`), pronto para virar configuração.

## D-013 · Stack do MVP (Q5) · 20/10/2026 · Aceita
**Decisão:** PWA em React + Vite + TypeScript + Tailwind; API Node com Fastify; monorepo npm workspaces com `packages/domain` (regras puras) e `packages/contracts` (validação e DTOs compartilhados); testes com Vitest.
**Consequências:** o convite abre no navegador sem instalar. Push no iOS continua limitado (Q7).

## D-014 · Idealizador cobre cargos vagos (RN-25) · 20/10/2026 · Aceita
**Contexto:** o PRD diz que só o General edita seu domínio, mas um rolê sem Tesoureiro ficaria sem ninguém para configurar sinal e fechar a conta.
**Decisão:** enquanto os cargos **Base** e **Tesouro** estão vagos, o Idealizador exerce as permissões deles. Quando alguém assume, as permissões passam integralmente para o General. Os cargos de Frota e Suprimentos não têm fallback, porque seus módulos são da Fase 2.
**Consequências:** o Tesoureiro efetivo nunca é indefinido (`getTreasurerId`).

## D-015 · Persistência e infraestrutura do MVP · 20/10/2026 · Aceita
**Decisão:** SQLite no MVP, acessado só por Kysely, com migrations e tipos portáveis (TEXT/INTEGER), de modo que migrar para PostgreSQL troca dialeto e migrations. Dinheiro sempre em centavos inteiros; datas em ISO-8601 UTC. Jobs agendados (expiração de prazo, lembretes) ficam numa tabela, executados por um runner com claim atômico e idempotência. Arquivos (comprovantes e notas) em disco atrás de uma interface (`FileStorage`) trocável por S3, servidos só a quem tem permissão.
**Consequências:** uma única instância do servidor no MVP (recuperação de jobs "running" na partida assume isso).

## D-016 · Regras do rateio na prática (ajusta D-007) · 20/10/2026 · Aceita
**Decisão:** as cotas automáticas (global, etílica, carne, vegetariana) são resolvidas **no fechamento**, sobre o roster final; subconjuntos explícitos (carro, por exemplo) são a cota `custom`, guardada na despesa. O roster é: confirmados em dia com o sinal (quando exigido) + o Tesoureiro. O sinal é crédito de quem pagou e dívida do Tesoureiro (que o segura). Centavos residuais de cada divisão vão para o Tesoureiro. O acerto usa o algoritmo guloso (maiores devedores com maiores credores), que gera no máximo n−1 transferências.
**Consequências:** quem bebe mas não pagou o sinal fica fora do rateio de bebida e, se pagou algo do bolso, é reembolsado integralmente pelos demais (ver Q13). Fechar a conta exige: nenhuma despesa pendente, nenhuma contestação aberta, nenhum comprovante em análise, nenhuma despesa sem beneficiários. Depois de fechada, nada muda.

## D-017 · QG do MVP tem três abas · 20/10/2026 · Aceita
**Decisão:** Base & Roteiro, **Equipe** e Cofre. O PRD previa duas abas no MVP, mas cargos e sorteio precisam de uma tela. Frotas e Mercado entram na Fase 2.

## D-018 · Login por telefone com código (OTP) · 20/10/2026 · Aceita, com provedor pendente
**Decisão:** sessão por cookie `httpOnly`, `SameSite=Lax`, 30 dias. O envio do código passa pela interface `OtpSender`; em desenvolvimento o código é impresso no console e devolvido na resposta (`OTP_DEV_ECHO`). Em produção, o servidor recusa subir com esse eco ligado e o envio falha explicitamente até existir um provedor real (Q11).

## D-019 · Direção visual "ordem de missão" · 20/10/2026 · Aceita
**Contexto:** a primeira versão (bege, verde-petróleo e coral) era a combinação genérica de app de viagem e não carregava a ideia do produto.
**Decisão:** o rolê é tratado como uma operação. O **bilhete com picote** (número de série em mono) é o objeto central do feed, do convite e do saldo. A massa crítica é o **medidor de andorinhas** (vagas que se preenchem) e o momento memorável é o **carimbo "Confirmado"** que cai quando o quórum fecha. Paleta: tinta de carimbo (navy `#0e1f3d`), sol (`#ffc72c`, a única cor de ação), carimbo (`#e0402a`, só para o que é definitivo) e uma mesa azul-acinzentada. Tipografia: Big Shoulders Display (títulos condensados em caixa-alta), Instrument Sans (texto) e IBM Plex Mono (códigos, prazos e valores), todas hospedadas no próprio app. Botões de ação são "teclas" com espessura. Ícones em SVG próprio (sem emojis na interface). Modo escuro automático pelos mesmos tokens.
**Consequências:** o amarelo só aparece na ação principal de cada tela. O carimbo e o bilhete não devem virar enfeite: carimbo só em decisões (confirmado), bilhete só para rolês e saldo. As cores vivem como tokens em `apps/web/src/styles.css`; nada de hex solto nos componentes.
