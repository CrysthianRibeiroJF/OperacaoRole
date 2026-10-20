# Regras de negócio

Regras precisas e testáveis. Cada regra tem um ID (`RN-xx`) para ser citada em tickets e testes. Se uma regra mudar, atualize também o ticket em [BACKLOG.md](../docs/BACKLOG.md) e registre em [decisoes.md](decisoes.md).

## Ciclo de vida do rolê

**Estados:** Rascunho → Proposta Aberta → Rolê Confirmado → (Janela do Sinal) → Operação → Acerto de Contas → Encerrado. Saídas: Arquivado (sem quórum) e Cancelado.

- **RN-01** Toda proposta tem prazo de resposta (padrão 48h) e quórum (padrão 3, faixa 2–6).
- **RN-02** O Idealizador conta como primeira confirmação.
- **RN-03** Quando as confirmações chegam ao quórum, o status muda para Rolê Confirmado e todos os envolvidos são notificados.
- **RN-04** Se o prazo vence sem quórum, a proposta é arquivada e o grupo é notificado de forma neutra.
- **RN-05** Um usuário pode trocar entre "Tô Dentro" e "Passo" enquanto a proposta estiver aberta.
- **RN-06** Respostas repetidas do mesmo usuário não geram participações duplicadas (idempotência).
- **RN-07** (D-011) Após confirmado, o rolê permanece confirmado mesmo se o número cair abaixo do quórum; o Idealizador é alertado (no máximo 1 vez por dia).
- **RN-08** O Idealizador não pode responder "Passo" no próprio rolê; se for o caso, cancela.
- **RN-09** Só o Idealizador cancela (rolê aberto ou confirmado). Cancelar com sinal pago só gera orientação de devolução (D-010).

## Sinal (anti-pipoca)

- **RN-10** (D-009) O sinal é opcional por rolê. A janela só abre com o rolê confirmado e a configuração completa (valor + chave Pix); prazo padrão de 48h. Depois de aberta, o valor não muda e o sinal não é desligado.
- **RN-11** O Tesoureiro define valor do sinal, chave Pix e prazo.
- **RN-12** Só entra na lista de confirmados com sinal quem anexar comprovante aprovado pelo Tesoureiro.
- **RN-13** Sem comprovante validado até o fim do prazo, o participante volta à lista de espera e a vaga passa ao próximo da fila.
- **RN-14** Só quem tem sinal validado pode escolher cama ou vaga no carro. *(No MVP aplica-se ao rateio; cama e carro chegam na Fase 2.)*
- **RN-16** O Tesoureiro não paga sinal a si mesmo: aparece sempre como "aprovado".
- **RN-17** Quem entra com a janela aberta nasce "pendente"; se o prazo já passou, nasce na fila de espera. Quem está na fila pode enviar comprovante e o Tesoureiro decide.
- **RN-18** Comprovantes aceitam imagem (JPG, PNG, WebP) ou PDF até 5 MB, identificados pelo conteúdo do arquivo. Só o dono e o Tesoureiro os veem.
- **RN-15** O app não custodia dinheiro (D-003).

## Papéis e permissões

- **RN-20** Cargos: Idealizador, General da Base, General da Frota, General de Suprimentos, General do Tesouro, Tropa, Observador.
- **RN-21** (D-012) Cargos são assumidos voluntariamente ou sorteados entre confirmados. O sorteio só preenche cargos vagos, prioriza quem tem menos cargos e respeita o teto. Quem larga um cargo sorteado não é sorteado de novo para ele.
- **RN-26** Teto de 2 cargos por pessoa por rolê. Cargos só abrem quando o rolê está confirmado.
- **RN-22** Permissões são aplicadas no servidor.
- **RN-23** Observador só lê: não vota, não escolhe vaga, não edita.
- **RN-24** Cargo vago perto do rolê (2 dias antes) dispara alerta de "Missão Pendente".
- **RN-25** (D-014) Enquanto os cargos Base e Tesouro estão vagos, o Idealizador exerce as permissões deles. Ao ser ocupado, o cargo passa integralmente ao General.

## Despesas e rateio

- **RN-30** Qualquer confirmado pode lançar despesa com valor, categoria, quem pagou, foto da nota e a quem se aplica.
- **RN-31** Despesas acima do limite (R$ 300 por padrão) lançadas por quem não é Tesoureiro exigem aprovação. As do Tesoureiro entram aprovadas.
- **RN-42** Só despesas aprovadas entram no rateio. Despesa custom só divide entre quem está no rolê.
- **RN-32** **Cota Global:** custo ÷ nº de confirmados com sinal validado.
- **RN-33** **Cota Etílica:** dividida só entre quem marcou "Eu bebo álcool".
- **RN-34** **Cota Carnívora/Vegetariana:** itens marcados por perfil alimentar; quem não consome não paga.
- **RN-35** **Cota de Veículo:** combustível e pedágio divididos entre os ocupantes do carro; isenção do motorista é opção do grupo, por rolê.
- **RN-36** O sinal pago é abatido do saldo individual; se exceder o custo, vira crédito a receber.
- **RN-37** Centavos residuais do arredondamento vão para o Tesoureiro.
- **RN-38** O acerto final minimiza o número de transferências (simplificação de dívidas).
- **RN-39** Qualquer confirmado pode contestar uma despesa em até 72h; o Tesoureiro decide e registra a justificativa.
- **RN-40** **Invariante:** a soma dos saldos de todos os participantes é sempre zero.
- **RN-41** Todo valor exibido é reproduzível a partir dos lançamentos (auditável). Ações relevantes gravam uma trilha de auditoria.
- **RN-43** (D-016) O roster do rateio é: confirmados em dia com o sinal (quando exigido) + o Tesoureiro. Quem pagou do bolso e ficou fora do roster é reembolsado integralmente.
- **RN-44** Fechar a conta exige: nenhuma despesa pendente, nenhuma contestação aberta, nenhum comprovante em análise e nenhuma despesa sem beneficiários.
- **RN-45** Depois de fechada, a conta não muda: não se lançam, contestam ou editam despesas.
- **RN-46** Cada pessoa vê só o próprio saldo e os próprios acertos; o Tesoureiro vê todos. O credor (ou o Tesoureiro) dá baixa quando o Pix cai.

## Notificações

- **RN-50** Máximo de 1 lembrete por gatilho a cada 24h.
- **RN-51** O usuário pode silenciar notificações por rolê.
- **RN-54** Cada notificação tem chave de deduplicação por usuário; lembretes recorrentes incluem o dia na chave.
- **RN-52** Cobrança pós-rolê é privada ao devedor (D-005); lembretes em D+3 e D+7.
- **RN-53** Tom das mensagens: impessoal, nunca acusatório.

## Gatilhos de notificação

| Gatilho | Quando |
|---|---|
| Massa crítica | Falta 1 pessoa para o quórum |
| Rolê confirmado | Ao atingir o quórum |
| Prazo do sinal | 24h e 3h antes do vencimento |
| Missão pendente | Cargo vago a poucos dias do rolê |
| Conta fechada | Ao fechar a conta |
| Cobrança | D+3 e D+7 |
