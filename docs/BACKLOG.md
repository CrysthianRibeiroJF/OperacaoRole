# Backlog — Operação Rolê

Derivado do [PRD](PRD-Operacao-Role.md) v0.1. Fonte de verdade das regras: [memorias/regras-de-negocio.md](../memorias/regras-de-negocio.md).

**Legenda**
- **Prioridade:** P0 = MVP, P1 = fast-follow, P2 = futuro.
- **Pts:** estimativa relativa (1, 2, 3, 5, 8). Ticket de 8 deve ser quebrado antes de entrar em sprint. São hipóteses, a engenharia deve revisar.
- **Dep:** tickets que precisam estar prontos antes.
- **Status:** `A fazer` | `Em andamento` | `Bloqueado` | `Parcial 🟡` | `Feito ✅`, no fim de cada título. Atualize aqui e registre decisões em [memorias/decisoes.md](../memorias/decisoes.md).
- **Bloq:** questão em aberto que trava o ticket (ver [memorias/questoes-abertas.md](../memorias/questoes-abertas.md)).

**Resumo:** 13 épicos (E0 a E12) · 70 tickets · P0: 51 tickets (185 pts) · P1: 16 · P2: 3

**Andamento do MVP (20/10/2026):** 37 tickets feitos ✅, 6 parciais 🟡, 27 a fazer. Do P0 faltam: descoberta com usuários (ROL-001, 002, 004), analytics (ROL-013), LGPD (ROL-121), termos de uso (ROL-123), beta fechado (ROL-124) e teste de carga e monitoramento (ROL-125). Todo o P1 (Fase 2) segue pendente.

| Épico | Tema | Fase | Prioridade |
|---|---|---|---|
| E0 | Descoberta e decisões | 0 | P0 |
| E1 | Fundação técnica | 1 | P0 |
| E2 | Identidade e acesso | 1 | P0 |
| E3 | Proposta e Massa Crítica | 1 | P0 |
| E4 | Papéis e permissões | 1 | P0 |
| E5 | Sinal Anti-Pipoca | 1 | P0 |
| E6 | Despesas e Rateio | 1 | P0 |
| E7 | Notificações "Chato Oficial" | 1 | P0 |
| E8 | QG: Base & Roteiro e Cofre | 1 | P0 |
| E9 | Frotas & Caronas | 2 | P1 |
| E10 | Mercado & Itens | 2 | P1 |
| E11 | Orçamento, clima e extras | 2 | P1 |
| E12 | Qualidade, segurança e lançamento | 1–2 | P0 |

---

## E0 — Descoberta e decisões (Fase 0)

### ROL-001 · Entrevistas com organizadores de rolê · P0 · 5 pts · **A fazer**
8–10 entrevistas para validar o problema, a regra das 3 andorinhas e a disposição a pagar sinal por Pix.
- [ ] Roteiro de entrevista pronto
- [ ] Síntese com temas por frequência e impacto salva em `memorias/aprendizados.md`
- [ ] Decisão go/no-go para o MVP registrada

### ROL-002 · Protótipo de teste do Convite (Figma ou papel) · P0 · 3 pts · Dep: ROL-001 · **A fazer**
Testar o cartão fechado e a tela "O Convite" com 5 grupos reais.
- [ ] Taxa de compreensão do cartão ≥ 80% sem explicação

### ROL-003 · Decidir Q1 a Q5 e registrar · P0 · 2 pts · Dep: ROL-001 · **Feito ✅**
Sinal opcional/obrigatório, responsabilidade legal, queda abaixo do quórum, sorteio de cargos, PWA vs. nativo.
- [ ] Cada decisão virou entrada em `memorias/decisoes.md` e a questão saiu de `questoes-abertas.md`

### ROL-004 · Parecer jurídico sobre o sinal via Pix · P0 · 3 pts · Bloq: Q2 · **A fazer**
Enquadramento como intermediador de pagamento, regra de reembolso, termos de uso.
- [ ] Parecer anexado; termos de uso rascunhados

---

## E1 — Fundação técnica

### ROL-010 · Setup do projeto PWA, CI e ambientes · P0 · 3 pts · Dep: ROL-003 · **Parcial 🟡**
> Parcial: sem pipeline de CI configurado (scripts de typecheck, lint, teste e build prontos).
Repositório, lint, testes, deploy de staging e produção.
- [ ] Pipeline roda testes a cada PR
- [ ] Staging acessível por URL

### ROL-011 · Modelo de dados núcleo · P0 · 5 pts · Dep: ROL-010 · **Feito ✅**
Entidades: Usuário, Rolê, Participação, Cargo, Sinal, Despesa, Lançamento/Cota, Notificação, Auditoria.
- [ ] Diagrama ER salvo em `memorias/`
- [ ] Despesas modeladas como lançamentos com "quem participa" por item (decisão do PRD para suportar P1/P2)

### ROL-012 · Design system base e tema mobile-first · P0 · 5 pts · Dep: ROL-010 · **Feito ✅**
Tokens, botões, cards, cronômetro, avatar de confirmados.
- [ ] Componentes documentados; contraste AA

### ROL-013 · Instrumentação de analytics (eventos de produto) · P0 · 3 pts · Dep: ROL-010 · **A fazer**
Eventos: proposta criada, resposta, quórum atingido, sinal pago, despesa, conta fechada.
- [ ] Todos os eventos da seção 9 do PRD emitem dados
- [ ] Plano de tracking salvo em `memorias/`

### ROL-014 · Motor de jobs agendados (cronômetros e lembretes) · P0 · 5 pts · Dep: ROL-011 · **Feito ✅**
Execução confiável de expirações de prazo, janelas de sinal e lembretes, idempotente.
- [ ] Um job nunca executa duas vezes o mesmo efeito
- [ ] Reprocessa após queda do servidor

---

## E2 — Identidade e acesso

### ROL-020 · Login por telefone (OTP) · P0 · 5 pts · Dep: ROL-011 · **Feito ✅**
- [ ] Código por SMS/WhatsApp com limite de tentativas e expiração
- [ ] Sessão persistente no mobile

### ROL-021 · Entrada de convidado via link com perfil mínimo · P0 · 3 pts · Dep: ROL-020 · **Feito ✅**
Nome e foto opcional; sem instalação.
- [ ] Abrir link sem conta mostra o Convite em modo leitura (Observador)
- [ ] Clicar em "Tô Dentro" pede login rápido e retorna à tela

### ROL-022 · Link compartilhável com pré-visualização para WhatsApp · P0 · 3 pts · Dep: ROL-030 · **Parcial 🟡**
> Parcial: link compartilhável e botão de WhatsApp prontos; falta a prévia Open Graph (exige renderização no servidor).
Open Graph com título, data, valor por pessoa e status.
- [ ] Prévia correta no WhatsApp Android e iOS

### ROL-023 · Perfil do evento: preferências de consumo · P0 · 2 pts · Dep: ROL-021 · **Feito ✅**
"Bebo álcool", "Carnívoro/Vegetariano".
- [ ] Preferências editáveis até o fechamento da conta, com trilha de auditoria

---

## E3 — Proposta e Massa Crítica

### ROL-030 · Criar Proposta Relâmpago (cartão fechado) · P0 · 5 pts · Dep: ROL-011, ROL-020 · **Feito ✅**
Campos: título, destino, data(s), teto de custo por pessoa, prazo (padrão 48h), quórum (padrão 3, faixa 2–6).
- [ ] Não publica com campo obrigatório vazio
- [ ] Criação em ≤ 2 min (mediana de teste de usabilidade)
- [ ] Idealizador conta como primeira andorinha

### ROL-031 · Tela "O Convite" · P0 · 5 pts · Dep: ROL-030, ROL-012 · **Feito ✅**
Foto, data, valor por pessoa, rostos dos confirmados, cronômetro, botão "Garantir Minha Vaga".
- [ ] Estados: aberta, confirmada, arquivada, lotada

### ROL-032 · Respostas "Tô Dentro" e "Passo" · P0 · 3 pts · Dep: ROL-031 · **Feito ✅**
- [ ] Usuário pode mudar de ideia enquanto a proposta estiver aberta
- [ ] Resposta duplicada não gera duas participações

### ROL-033 · Motor de Massa Crítica (transição para Rolê Confirmado) · P0 · 5 pts · Dep: ROL-032, ROL-014 · **Feito ✅**
- Given quórum N, When o N-ésimo confirma, Then status = Rolê Confirmado e todos são notificados.
- [ ] Confirmações simultâneas não geram estado inconsistente (teste de concorrência)
- [ ] Prazo expirado sem quórum arquiva e notifica de forma neutra

### ROL-034 · Regra de queda abaixo do quórum pós-confirmação · P0 · 2 pts · Bloq: Q3 · Dep: ROL-033 · **Feito ✅**
Proposta do PRD: permanece confirmado, com alerta ao Idealizador.

### ROL-035 · Feed de Rolês (tela inicial) · P0 · 5 pts · Dep: ROL-031 · **Feito ✅**
Ativos, propostas com cronômetro, histórico com custo final.
- [ ] Estado vazio com chamada para criar o primeiro rolê

### ROL-036 · Cancelamento e encerramento do rolê · P0 · 3 pts · Dep: ROL-033 · **Parcial 🟡**
> Parcial: cancelamento pronto; reembolso do sinal é só orientação em notificação (o app não movimenta dinheiro).
- [ ] Cancelar após confirmação dispara regra de reembolso de sinal (depende de Q1/Q2)

---

## E4 — Papéis e permissões

### ROL-040 · Estrutura de cargos e matriz de permissões · P0 · 5 pts · Dep: ROL-011 · **Feito ✅**
Idealizador, Generais (Base, Frota, Suprimentos, Tesouro), Tropa, Observador.
- [ ] Permissões aplicadas no servidor, não só na tela
- [ ] Testes automatizados cobrem cada linha da matriz do PRD

### ROL-041 · Assumir cargo voluntariamente · P0 · 3 pts · Dep: ROL-040 · **Feito ✅**
- [ ] Cargo só para confirmados; acúmulo configurável pelo Idealizador

### ROL-042 · Sorteio de cargos entre confirmados · P0 · 3 pts · Bloq: Q4 · Dep: ROL-040 · **Feito ✅**
- [ ] Sorteio auditável; participante pode recusar conforme decisão de Q4

### ROL-043 · Alerta de cargo vago (Missão Pendente) · P0 · 2 pts · Dep: ROL-040, ROL-014 · **Feito ✅**
- [ ] Dispara quando faltam X dias e o cargo continua vago

### ROL-044 · Modo Observador · P0 · 2 pts · Dep: ROL-040 · **Feito ✅**
- [ ] Leitura apenas: não vota, não escolhe vaga, não edita

### ROL-045 · Transferência do cargo de Idealizador · P1 · 2 pts · Bloq: Q10 · **A fazer**

---

## E5 — Sinal Anti-Pipoca

### ROL-050 · Configurar Janela do Sinal (Tesoureiro) · P0 · 3 pts · Bloq: Q1 · Dep: ROL-040 · **Feito ✅**
Valor do sinal, chave Pix, prazo.
- [ ] Opcional por rolê (conforme Q1)

### ROL-051 · Alerta de sinal ao confirmado com botão copiar Pix · P0 · 2 pts · Dep: ROL-050, ROL-070 · **Feito ✅**

### ROL-052 · Envio e validação de comprovante · P0 · 5 pts · Dep: ROL-050 · **Feito ✅**
- [ ] Fila de comprovantes para o Tesoureiro; aprovar ou rejeitar com motivo
- [ ] Armazenamento seguro de imagem; acesso restrito ao Tesoureiro e ao dono

### ROL-053 · Expiração do prazo: devolução para lista de espera · P0 · 3 pts · Dep: ROL-052, ROL-014 · **Feito ✅**
- [ ] Quem não paga volta para a espera automaticamente e é avisado

### ROL-054 · Trava de benefícios: só com sinal validado escolhe vaga/cama · P0 · 2 pts · Dep: ROL-052 · **Parcial 🟡**
> Parcial: o rateio já exclui quem não está quite; a escolha de cama/carro depende dos módulos da Fase 2.

### ROL-055 · Fila de espera com promoção automática · P1 · 3 pts · Dep: ROL-053 · **A fazer**

---

## E6 — Despesas e Rateio

### ROL-060 · Lançar despesa com foto da nota · P0 · 5 pts · Dep: ROL-011, ROL-040 · **Feito ✅**
Valor, categoria, quem pagou, a quem se aplica (cota).
- [ ] Lançamento em ≤ 10 s em fluxo otimizado (câmera → valor → enviar)

### ROL-061 · Aprovação de despesas acima do limite · P0 · 3 pts · Dep: ROL-060 · **Feito ✅**
- [ ] Tesoureiro aprova ou rejeita; histórico preservado

### ROL-062 · Motor de cotas (Global, Etílica, Carnívora/Vegetariana, Veículo) · P0 · 8 pts → quebrar · Dep: ROL-060, ROL-023 · **Feito ✅**
Implementa as regras 1–4 de [regras-de-negocio.md](../memorias/regras-de-negocio.md).
- [ ] Quebrar em: 062a motor Global, 062b Etílica, 062c Carnívora/Vegetariana, 062d Veículo (depende de E9, entra no MVP só como "cota manual" até lá)

### ROL-063 · Abatimento do sinal e arredondamento · P0 · 3 pts · Dep: ROL-062 · **Feito ✅**
- [ ] Crédito a receber quando sinal excede o custo
- [ ] Centavos residuais atribuídos ao Tesoureiro

### ROL-064 · Simplificação de dívidas (mínimo de transferências) · P0 · 5 pts · Dep: ROL-063 · **Feito ✅**
- [ ] Soma dos saldos de todos é sempre zero (teste de invariante com dados aleatórios)

### ROL-065 · "Fechar Conta do Rolê" e tela de acerto · P0 · 5 pts · Dep: ROL-064 · **Feito ✅**
- [ ] Cada pessoa vê só o seu saldo e a quem pagar; Tesoureiro vê tudo
- [ ] Todo valor é reproduzível a partir dos lançamentos (tela de auditoria)

### ROL-066 · Contestação de despesa em 72h · P0 · 3 pts · Dep: ROL-060 · **Feito ✅**
- [ ] Contestação registrada, decisão do Tesoureiro com justificativa

### ROL-067 · Confirmar pagamento recebido (baixa manual) · P0 · 2 pts · Dep: ROL-065 · **Feito ✅**
- [ ] Credor ou Tesoureiro marca como quitado; alimenta a métrica de quitação em 7 dias

---

## E7 — Notificações "Chato Oficial"

### ROL-070 · Serviço de notificações multicanal · P0 · 5 pts · Bloq: Q7 · Dep: ROL-014 · **Parcial 🟡**
> Parcial: só notificações dentro do app; faltam push, e-mail e WhatsApp (ponto de extensão pronto).
Push web, e-mail e fallback WhatsApp/SMS.
- [ ] Máximo de 1 lembrete por gatilho a cada 24h
- [ ] Usuário silencia por rolê

### ROL-071 · Alerta de Massa Crítica ("falta 1 pessoa") · P0 · 2 pts · Dep: ROL-070, ROL-033 · **Feito ✅**

### ROL-072 · Alertas do prazo do sinal (24h e 3h) · P0 · 2 pts · Dep: ROL-070, ROL-050 · **Feito ✅**

### ROL-073 · Cobrança pós-rolê (D+3, D+7), privada ao devedor · P0 · 3 pts · Dep: ROL-070, ROL-065 · **Feito ✅**
- [ ] Nunca expõe devedor ao grupo; botão copiar Pix na mensagem

### ROL-074 · Central de preferências de notificação · P1 · 3 pts · Dep: ROL-070 · **A fazer**

---

## E8 — QG do Rolê: Base & Roteiro e Cofre

### ROL-080 · Estrutura do QG com abas · P0 · 3 pts · Dep: ROL-033, ROL-012 · **Feito ✅**
Abas do MVP: Base & Roteiro e Cofre. Demais abas aparecem quando liberadas (Fase 2).

### ROL-081 · Aba Base & Roteiro (versão enxuta) · P0 · 5 pts · Dep: ROL-080 · **Feito ✅**
Endereço, Wi-Fi com botão copiar, regras da casa, cronograma simples.
- [ ] Edição apenas pelo General da Base

### ROL-082 · Aba Cofre (visão financeira individual) · P0 · 5 pts · Dep: ROL-080, ROL-060 · **Feito ✅**
Quanto já gastei, notas lançadas, saldo atual, botão pagar/receber via Pix.

### ROL-083 · Distribuição de quartos · P1 · 3 pts · Dep: ROL-081, ROL-054 · **A fazer**

---

## E9 — Frotas & Caronas (Fase 2)

### ROL-090 · Cadastro de carro (vitrine) · P1 · 3 pts · Dep: ROL-040 · **A fazer**
Bairro, horário, assentos, capacidade de carga.

### ROL-091 · Reserva de assento estilo mapa de avião · P1 · 5 pts · Dep: ROL-090, ROL-054 · **A fazer**

### ROL-092 · Alocação de itens volumosos por veículo · P1 · 3 pts · Dep: ROL-090 · **A fazer**
- [ ] Alerta quando a carga alocada excede a capacidade informada

### ROL-093 · Cota de Veículo automática (combustível, pedágio, isenção do motorista) · P1 · 5 pts · Dep: ROL-091, ROL-062 · **A fazer**

### ROL-094 · Ponto de encontro e atalhos Waze/Google Maps · P1 · 2 pts · Dep: ROL-090 · **A fazer**

---

## E10 — Mercado & Itens (Fase 2)

### ROL-100 · Lista de compras por categoria · P1 · 5 pts · Dep: ROL-040 · **A fazer**
Churrasco, bebidas alcoólicas e não alcoólicas, café da manhã, limpeza/descartáveis.

### ROL-101 · Quantidade sugerida (pessoas × dias) · P1 · 3 pts · Dep: ROL-100 · **A fazer**

### ROL-102 · Preço estimado vs. real pago e baixa de itens · P1 · 3 pts · Dep: ROL-100, ROL-060 · **A fazer**

### ROL-103 · Microtarefas "eu levo" · P1 · 2 pts · Dep: ROL-100 · **A fazer**

---

## E11 — Orçamento, clima e extras (Fase 2 e além)

### ROL-110 · Simulador de orçamento ao vivo (valor por cabeça) · P1 · 3 pts · Dep: ROL-031 · **A fazer**

### ROL-111 · Previsão do tempo para as datas · P1 · 3 pts · Dep: ROL-031 · **A fazer**

### ROL-112 · Mural da Base fixo durante a viagem · P1 · 2 pts · Dep: ROL-081 · **A fazer**
Wi-Fi, código do cadeado, check-out, regras críticas.

### ROL-113 · Guia de sobrevivência do entorno · P2 · 5 pts · Dep: ROL-081 · **A fazer**

### ROL-114 · Leitura de nota fiscal por OCR · P2 · 8 pts → quebrar · Dep: ROL-060 · **A fazer**

### ROL-115 · Conciliação automática via Pix Cobrança / Open Finance · P2 · 8 pts → quebrar · Dep: ROL-065 · **A fazer**

---

## E12 — Qualidade, segurança e lançamento

### ROL-120 · Suíte de testes de regras de negócio (quórum, rateio, permissões) · P0 · 5 pts · Dep: ROL-033, ROL-064, ROL-040 · **Feito ✅**

### ROL-121 · LGPD: consentimento, minimização, retenção e exclusão · P0 · 5 pts · Dep: ROL-011 · **A fazer**
- [ ] Comprovantes e notas com retenção definida e exclusão sob pedido

### ROL-122 · Segurança de acesso a comprovantes e dados financeiros · P0 · 3 pts · Dep: ROL-052 · **Parcial 🟡**
> Parcial: autorização por papel em todos os endpoints e arquivos servidos só com sessão; falta revisão de segurança externa.
- [ ] Links assinados com expiração; revisão de autorização por papel

### ROL-123 · Termos de uso e aviso "o app não custodia dinheiro" · P0 · 2 pts · Dep: ROL-004 · **A fazer**

### ROL-124 · Beta fechado com 10 grupos · P0 · 3 pts · Dep: Fase 1 completa · **A fazer**
- [ ] Métricas G1, G2 e G4 coletadas e comparadas com as metas

### ROL-125 · Teste de carga básico e monitoramento de erros · P0 · 3 pts · Dep: ROL-010 · **A fazer**

---

## Sugestão de sprints (2 semanas, equipe pequena, ~25 pts/sprint)

| Sprint | Foco | Tickets |
|---|---|---|
| S0 | Descoberta | ROL-001 a 004 |
| S1 | Fundação | ROL-010 a 014, ROL-011 |
| S2 | Acesso + proposta | ROL-020 a 023, ROL-030, ROL-031 |
| S3 | Quórum e feed | ROL-032 a 036, ROL-040 |
| S4 | Papéis + sinal | ROL-041 a 044, ROL-050 a 054 |
| S5 | Despesas | ROL-060, 061, 066, ROL-062 (a, b, c), ROL-070 |
| S6 | Rateio e acerto | ROL-062d (manual), ROL-063 a 067, ROL-071 a 073 |
| S7 | QG e qualidade | ROL-080 a 082, ROL-120 a 125 |
| Beta | Lançamento fechado | ROL-124 |
| Fase 2 | P1 | E9, E10, E11 e ROL-055, 074, 083 |

**Caminho crítico:** ROL-003/004 → ROL-011 → ROL-030 → ROL-033 → ROL-050 → ROL-052 → ROL-062 → ROL-065. Qualquer atraso em Q1, Q2 ou Q3 trava a cadeia de sinal, rateio e cancelamento.
