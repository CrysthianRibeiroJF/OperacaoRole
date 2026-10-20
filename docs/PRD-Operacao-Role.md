# PRD — Operação Rolê

**Versão:** 0.1 (rascunho para revisão) · **Data:** 20/10/2026 · **Status:** Em discussão
**Resumo em uma linha:** um app que transforma "vamos marcar algo?" em rolê confirmado, com tarefas distribuídas e contas fechadas, sem depender de unanimidade nem de discussão infinita no WhatsApp.

---

## 1. Problema

Grupos de amigos (6–20 pessoas) falham em transformar intenção em rolê. A ideia surge no WhatsApp, a discussão se arrasta ("quem vai?", "quanto fica?", "qual data?"), todo mundo espera a confirmação dos outros e o rolê morre, ou acontece com uma pessoa (quem teve a ideia) sobrecarregada de organização, cobrança e rateio. Depois, o acerto de contas gera desconforto e calotes.

**Quem sofre:** o organizador informal (carga mental e financeira), e os participantes que querem ir mas só se comprometem quando "tiver certeza que o rolê vai rolar".
**Custo de não resolver:** rolês que não acontecem, amizades desgastadas por cobrança e perda de confiança em quem organiza.

> **Premissa a validar:** os pontos acima vêm do plano de produto, sem pesquisa de usuário anexada. Antes do build, validar com 8–10 entrevistas de organizadores de rolê (ver seção 9).

---

## 2. Objetivos

| # | Objetivo | Tipo | Meta (hipótese inicial) |
|---|---|---|---|
| G1 | Reduzir o tempo da ideia até o rolê confirmado | Usuário | Mediana ≤ 24h entre criação da proposta e status "Confirmado" |
| G2 | Aumentar a conversão de propostas em rolês confirmados | Usuário/Negócio | ≥ 50% das propostas com link compartilhado atingem o quórum |
| G3 | Distribuir a organização | Usuário | ≥ 70% dos rolês confirmados têm ao menos 2 cargos além do Idealizador preenchidos |
| G4 | Fechar contas sem calote | Usuário | ≥ 90% do saldo devedor quitado em até 7 dias após o fechamento |
| G5 | Gerar crescimento orgânico via convite | Negócio | ≥ 1,5 novo usuário ativado por rolê criado (K-factor de grupo) |

## 3. Não-Objetivos (v1)

1. **Processar pagamentos dentro do app.** O app mostra a chave Pix e recebe comprovantes; não custodia dinheiro. *Motivo:* evita regulação financeira e reduz escopo.
2. **Reserva/compra de hospedagem, ingressos ou transporte.** O app organiza, não vende. *Motivo:* outra categoria de produto.
3. **Chat próprio.** O link é compartilhado no WhatsApp; o app gera notificações, não conversa. *Motivo:* competir com o WhatsApp é inviável e desnecessário.
4. **Roteiro turístico completo e recomendações de lugares.** *Motivo:* o problema central é decisão e dinheiro, não descoberta.
5. **Eventos públicos/abertos a desconhecidos.** v1 é só para grupos fechados por link. *Motivo:* moderação e segurança.

---

## 4. Personas e Papéis

| Persona | Descrição | Papel no app |
|---|---|---|
| **Faísca** | Quem tem a ideia e quer que ela aconteça sem virar "mãe do grupo" | Idealizador |
| **Anfitrião/Motorista/Tesoureiro** | Quem topa assumir uma responsabilidade específica | Generais (Base, Frota, Suprimentos, Tesouro) |
| **Tropa** | Quer ir, pagar sua parte e fazer pouco esforço | Confirmado |
| **Em cima do muro** | Quer ver se o rolê vai rolar antes de decidir | Observador |

**Matriz de permissões** (resumo; detalhes nos requisitos):

| Ação | Idealizador | General (no seu domínio) | Tropa | Observador |
|---|---|---|---|---|
| Criar evento / definir quórum | ✔ | | | |
| Editar dados da Base | | Base | | |
| Cadastrar carros, alocar passageiros | | Frota | Escolher vaga | |
| Editar lista de mercado | | Suprimentos | Assumir itens | |
| Validar comprovantes, fechar conta | | Tesouro | Lançar despesa | |
| Votar / escolher vaga/quarto | | ✔ | ✔ | ✘ |
| Visualizar | ✔ | ✔ | ✔ | ✔ |

---

## 5. Histórias de Usuário

**Idealizador**
- Como Idealizador, quero lançar um cartão fechado (destino, data, teto de gasto por pessoa, prazo) em menos de 2 minutos, para o grupo responder "sim/não" em vez de debater.
- Como Idealizador, quero definir o quórum mínimo (padrão 3), para o rolê virar oficial sem esperar todo mundo.
- Como Idealizador, quero que o app avise o grupo sobre prazos e pendências, para eu não ter que cobrar ninguém.

**Participante (Tropa)**
- Como convidado, quero ver a proposta sem criar conta pesada (login rápido), para decidir na hora.
- Como convidado, quero ver quem já confirmou e o valor estimado por pessoa, para decidir se entro.
- Como confirmado, quero pagar o sinal via Pix e anexar o comprovante, para garantir minha vaga.
- Como confirmado, quero assumir uma microtarefa ("levo o gelo"), para contribuir sem esforço grande.
- Como confirmado, quero lançar uma despesa com foto da nota em até 10 segundos, para ser reembolsado.

**Generais**
- Como General da Base, quero publicar endereço, Wi-Fi, regras e distribuição de quartos num único mural.
- Como General da Frota, quero cadastrar carros com assentos e capacidade de carga e alocar passageiros.
- Como General de Suprimentos, quero uma lista por categoria com quantidades sugeridas e preço estimado.
- Como General do Tesouro, quero validar comprovantes e fechar a conta com um clique, com cálculo automático de quem deve a quem.

**Observador**
- Como Observador, quero ver o andamento sem poder interferir, até decidir confirmar.

**Casos de borda**
- Como participante, quero ser avisado se perdi minha vaga por não pagar o sinal e entrar na fila de espera.
- Como Idealizador, quero que a proposta seja arquivada automaticamente se o quórum não for atingido no prazo.
- Como participante, quero poder desistir após confirmar, sabendo claramente a regra de reembolso do sinal.

---

## 6. Requisitos Funcionais

### 6.1 Must-Have (P0): MVP

**R1 — Proposta Relâmpago (Card fechado)**
Campos obrigatórios: título, destino, data(s), teto/estimativa de custo por pessoa, prazo de resposta (padrão 48h), quórum mínimo (padrão 3, faixa 2–6). Gera link compartilhável com pré-visualização (Open Graph) para WhatsApp.
*Critérios de aceite:*
- [ ] Proposta não pode ser publicada com campo obrigatório vazio.
- [ ] O link abre a tela "O Convite" sem exigir instalação do app (web).
- [ ] Cronômetro regressivo visível em tempo real.

**R2 — Motor de Massa Crítica (Regra das Andorinhas)**
- Given uma proposta em Rascunho/Aberta com quórum N, When o N-ésimo usuário clica "Tô Dentro", Then o status muda para **Rolê Confirmado** e todos os envolvidos são notificados.
- Given o prazo expirou sem atingir o quórum, Then o evento é arquivado e o grupo é notificado de forma neutra.
- [ ] O Idealizador conta como 1ª andorinha automaticamente.
- [ ] Confirmações concorrentes no mesmo instante não geram estado inconsistente (idempotência).
- [ ] Quem clicou "Passo" pode mudar de ideia enquanto a proposta estiver aberta.

**R3 — Autenticação leve e convite por link**
Login por telefone (OTP) ou conta social; convidados entram com nome e foto mínimos. Sem cadastro, só leitura limitada (Observador).

**R4 — Papéis e permissões**
Cargos: Idealizador, Generais (Base, Frota, Suprimentos, Tesouro), Tropa, Observador. Cargos são assumidos voluntariamente ou **sorteados** entre confirmados. Cada cargo tem escopo de edição estrito conforme a matriz da seção 4.
- [ ] Observador não vota, não escolhe vaga e não edita.
- [ ] Um usuário pode acumular cargos (configurável pelo Idealizador).
- [ ] Cargo vago há mais de X horas gera alerta ("Missão Pendente").

**R5 — Janela do Sinal (Trava Anti-Pipoca)**
Quando o rolê exige reserva, o Tesoureiro define valor do sinal, chave Pix e prazo. Cada "Tô Dentro" recebe alerta com valor e chave (botão copiar).
- Given um confirmado sem comprovante, When o prazo vence, Then ele volta para a lista de espera e a vaga é oferecida ao próximo da fila.
- [ ] Só quem tem sinal validado escolhe cama/vaga no carro.
- [ ] O Tesoureiro vê a fila de comprovantes e aprova/rejeita com motivo.

**R6 — Lançamento de despesas**
Qualquer confirmado cria despesa: valor, categoria, foto da nota, quem pagou, a quem se aplica (cota). Tesoureiro aprova despesas acima de um limite definido.

**R7 — Rateio e Fechamento de Conta**
Cotas: **Global**, **Etílica**, **Carnívora/Vegetariana** e **Veículo**; desconta o sinal já pago; produz lista mínima de transferências ("fulano paga R$ X a beltrano"). Ver regras em 6.4.

**R8 — Notificações do "Chato Oficial"** (push + WhatsApp/e-mail como fallback): massa crítica, prazo do sinal, missão pendente e cobrança pós-rolê (catálogo na seção 6.5).

**R9 — Feed de Rolês e Convite**
Tela inicial com rolês ativos, propostas abertas (com cronômetro) e histórico com custo final; tela "O Convite" com botão de ação principal "Garantir Minha Vaga".

**R10 — QG do Rolê (versão enxuta)**
Abas: **Base & Roteiro** (endereço, Wi-Fi, regras, cronograma simples), **Cofre** (financeiro).

### 6.2 Nice-to-Have (P1): fast-follow

- **R11 — Frotas & Caronas:** vitrine de carros (bairro, horário, assentos, capacidade de carga), reserva de assento estilo "mapa de avião", alocação de itens volumosos por veículo.
- **R12 — Mercado & Itens:** lista por categoria, quantidade sugerida pelo app (pessoas × dias), preço médio estimado vs. real, microtarefas ("eu levo").
- **R13 — Simulador de orçamento ao vivo:** valor por cabeça recalculado conforme mais gente entra.
- **R14 — Previsão do tempo** para as datas do evento.
- **R15 — Mural da Base fixo** com botão copiar para Wi-Fi e código do cadeado.
- **R16 — Fila de espera automática** com promoção do próximo.
- **R17 — Atalhos Waze/Google Maps.**

### 6.3 Considerações Futuras (P2)

- Guia de sobrevivência no entorno (mercado barato, farmácia, hospital).
- Preços médios por região alimentados por dados reais ou nota fiscal (NFC-e).
- Integração com Pix Cobrança/Open Finance para conciliação automática.
- Leitura de nota fiscal por OCR.
- Recorrência de grupos ("turma da praia") e reaproveitamento de rolês passados.
- Gamificação (reputação do pagador pontual, selos).

*Decisão de arquitetura:* modelar despesas e cotas desde o início como lançamentos com "quem participa" por item, para suportar P1/P2 sem migração.

### 6.4 Regras do rateio (especificação detalhada)

1. **Cota Global:** custo ÷ nº de confirmados com sinal validado.
2. **Cota Etílica:** dividida só entre quem marcou "Eu bebo álcool".
3. **Cota Carnívora/Vegetariana:** itens marcados por perfil alimentar; quem não consome não paga.
4. **Cota de Veículo:** combustível e pedágio divididos entre os ocupantes do carro; opção de isentar o motorista (decisão do grupo, configurável por rolê).
5. **Sinal:** abatido do saldo individual. Se o sinal excede o custo individual, o app gera crédito a receber.
6. **Arredondamento:** centavos residuais atribuídos ao Tesoureiro (regra única e transparente).
7. **Simplificação de dívidas:** algoritmo minimiza o nº de transferências (ex.: A deve a B, B deve a C → A paga a C).
8. **Despesa contestada:** qualquer confirmado pode contestar em até 72h; o Tesoureiro decide e registra.
- [ ] Soma dos saldos de todos os participantes é sempre zero (invariante testada).
- [ ] Todo valor exibido é reproduzível a partir dos lançamentos (auditável).

### 6.5 Catálogo de notificações ("Chato Oficial")

| Gatilho | Mensagem (exemplo) | Canal |
|---|---|---|
| Faltam N para o quórum | "Falta apenas 1 pessoa confirmar para o rolê de sábado virar oficial!" | Push + link WhatsApp |
| Rolê confirmado | "Rolê confirmado! 🎉" | Push |
| Prazo do sinal vencendo (24h, 3h) | "O prazo do Pix vence hoje às 20h. Vagas não pagas vão para a fila." | Push + WhatsApp/e-mail |
| Cargo/missão vago (D-2) | "Faltam 2 dias e ninguém levou o cooler. Quem se habilita?" | Push |
| Conta fechada | "A conta fechou! Seu saldo é R$ 64,50 para o Pedro." + botão copiar Pix | Push + WhatsApp/e-mail |
| Cobrança pós-rolê (D+3, D+7) | Lembrete neutro ao devedor | Push |

Regras: máximo de 1 lembrete por gatilho a cada 24h; usuário pode silenciar por rolê; tom impessoal, nunca expõe devedores ao grupo todo (ver Q6).

---

## 7. Fluxo e Estados do Rolê

```
Rascunho → Proposta Aberta → [quórum atingido] → Rolê Confirmado
                 │                                    │
                 └─ prazo vence sem quórum → Arquivado│
                                                      ▼
                         Janela do Sinal (se houver reserva) → Operação (pré/durante)
                                                                       │
                                                                       ▼
                                                          Acerto de Contas → Encerrado
```

Transições relevantes: cancelamento pelo Idealizador após confirmação (regra de reembolso do sinal), queda abaixo do quórum após desistências (ver Q3).

## 8. Mapa de Telas

1. **Feed de Rolês** (ativos, propostas com cronômetro, histórico com custo).
2. **O Convite** (foto, data, clima, valor por pessoa, rostos dos confirmados, botão "Garantir Minha Vaga").
3. **QG do Rolê** (pós-confirmação): abas **Base & Roteiro**, **Frotas & Caronas**, **Mercado & Itens**, **Cofre**.
4. **Criar Proposta** (formulário do cartão fechado).
5. **Fechamento de Conta** (visão do Tesoureiro e visão individual).

**Princípios de UX:** mobile-first, ação principal sempre visível, fluxo de criar proposta ≤ 2 min, lançar despesa ≤ 10 s, abrir convite sem instalar.

---

## 9. Métricas de Sucesso

**Indicadores antecedentes (dias/semanas)**

| Métrica | Definição | Meta | Stretch |
|---|---|---|---|
| Tempo até confirmar | Mediana criação → Confirmado | ≤ 24h | ≤ 8h |
| Taxa de conversão de proposta | Propostas confirmadas ÷ criadas | ≥ 50% | ≥ 65% |
| Ativação de convidado | Convidados que respondem "Tô Dentro/Passo" ÷ convidados que abrem o link | ≥ 60% | ≥ 75% |
| Sinal no prazo | Confirmados que pagam sinal dentro da janela | ≥ 80% | ≥ 90% |
| Tempo de criação | Abrir "criar" → publicar | ≤ 2 min (mediana) | ≤ 90 s |
| Cargos preenchidos | % de rolês com ≥ 2 Generais | ≥ 70% | ≥ 85% |

**Indicadores retardatários (meses)**

| Métrica | Meta |
|---|---|
| Retenção de grupo: grupo cria 2º rolê em até 60 dias | ≥ 40% |
| Quitação em 7 dias após fechamento de conta | ≥ 90% |
| NPS do Idealizador | ≥ 50 |
| Novos usuários por rolê (viralidade) | ≥ 1,5 |

*Medição:* instrumentar eventos de produto (criação, resposta, quórum, sinal, despesa, fechamento) desde o MVP; avaliar em 30 e 90 dias após lançamento fechado.

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Regra das 3 andorinhas confirma rolê "pequeno demais" e frustra o resto | Médio | Quórum configurável (2–6); exibir custo/pessoa com N atual; rolês podem exigir reserva só depois |
| Tesoureiro vira ponto único de falha/desconfiança | Alto | Trilha de auditoria visível, contestação, possibilidade de co-tesoureiro (P1) |
| Sinal Pix sem custódia: golpe ou disputa de reembolso | Alto | Termos claros; app não custodia; regra de reembolso explícita; comprovante + validação humana |
| Cobrança automática percebida como invasiva | Médio | Tom neutro, silenciamento por rolê, sem exposição pública de devedores |
| Cold start: só funciona se o grupo adotar | Alto | Experiência web sem instalação para convidados; só o Idealizador precisa "conhecer" o app |
| Custo/qualidade de dados de preço e clima | Baixo | Preço = estimativa editável pelo General; clima via API pública |
| LGPD: dados pessoais, comprovantes, fotos de notas | Médio | Minimização de dados, retenção limitada, consentimento claro |

---

## 11. Questões em Aberto

**Bloqueantes (antes de construir)**
- **Q1 (Produto):** o sinal deve ser opcional ou obrigatório no MVP? Rolês sem reserva (bate e volta) pulam a Fase 2? *Proposta: opcional, ligado quando há custo de reserva.*
- **Q2 (Jurídico):** quem é o responsável legal pelo dinheiro do sinal e pelo reembolso em caso de cancelamento? Há risco de o app ser enquadrado como intermediador de pagamento? **Responsável: jurídico.**
- **Q3 (Produto):** o que acontece se, após "Rolê Confirmado", pessoas desistirem e o número cair abaixo do quórum? Volta para Rascunho, ou o status é permanente? *Proposta: permanece confirmado, com alerta ao Idealizador.*
- **Q4 (Produto):** sorteio de cargos: pode recusar? Qual o limite de acúmulo?
- **Q5 (Engenharia):** web app (PWA) ou app nativo no MVP? *Recomendação: PWA, pela exigência de convite por link sem instalação.*

**Não bloqueantes**
- **Q6 (Design/Produto):** a lista de devedores é visível a todos ou só ao Tesoureiro e ao próprio devedor? *Recomendação: privada.*
- **Q7 (Engenharia):** canal de notificação principal: push web é fraco no iOS; usar WhatsApp Business API (custo) ou e-mail/SMS como fallback?
- **Q8 (Dados):** fonte de preços médios: tabela editável pelo grupo, dados de terceiros ou histórico anonimizado do próprio app?
- **Q9 (Negócio):** modelo de monetização (assinatura do grupo, taxa por rolê, premium) ou gratuito no MVP?
- **Q10 (Produto):** múltiplos idealizadores / transferência do cargo de Idealizador.

---

## 12. Fases de Entrega e Timeline

| Fase | Escopo | Objetivo de aprendizado |
|---|---|---|
| **0. Descoberta (2 sem)** | 8–10 entrevistas, teste do cartão em papel/Figma, decisões Q1–Q5 | Validar o problema e a regra das 3 andorinhas |
| **1. MVP "Faísca + Conta" (6–8 sem)** | R1–R10: proposta, quórum, papéis, sinal, despesas, rateio, notificações | Provar G1, G2 e G4 |
| **2. "Operação" (4–6 sem)** | R11–R17: frotas, mercado, simulador, clima, mural | Aumentar G3 e retenção |
| **3. Escala (a definir)** | Itens P2, integrações de pagamento, recorrência | Crescimento e monetização |

*Estimativas são hipóteses e devem ser revisadas com engenharia.* **Sem prazos fixos externos** conhecidos; recomenda-se lançamento fechado (beta) antes de um verão/feriado prolongado para aproveitar a sazonalidade de rolês.
**Dependências:** definição jurídica do sinal (Q2), provedor de OTP/notificações, API de clima.

---

## 13. Pontos que o plano original deixou implícitos (e que este PRD fixa)

1. **A regra de 3 confirmados** vira parâmetro configurável (padrão 3) e o Idealizador conta como primeiro voto.
2. **"Confirmado" e "Confirmado com sinal pago"** são estados distintos: o primeiro destrava o rolê, o segundo garante a vaga.
3. **O app não custodia dinheiro:** só orienta e registra Pix feitos entre pessoas.
4. **Cobrança é privada:** o "Chato Oficial" fala com o devedor, não expõe ao grupo.
5. **MVP enxuto:** logística de carros, mercado detalhado, clima e guia de entorno ficam para as fases seguintes, porque o que mais testa a tese do produto é *proposta → quórum → sinal → acerto de contas*.
