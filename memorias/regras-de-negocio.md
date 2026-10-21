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
- **RN-14** Só quem tem sinal validado pode escolher cama ou vaga no carro. *(Vale para o rateio, os carros e os quartos.)*
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

## Mercado & Itens (Fase 2)

- **RN-60** A lista de mercado só é editável com o rolê confirmado. Criar, editar, remover e montar a lista sugerida é do General de Suprimentos (ou do Idealizador, se o cargo estiver vago).
- **RN-61** A lista sugerida usa quantas pessoas, quantos bebem, quantos são vegetarianos e quantos dias; só pode ser gerada com a lista vazia.
- **RN-62** Qualquer confirmado assume um item livre ("eu levo"); um item tem um responsável.
- **RN-63** Quem assumiu o item (ou o General) dá baixa. A baixa pode lançar a despesa paga por quem comprou, com a cota da categoria: churrasco = só quem come carne, vegetariano = só vegetarianos, bebida alcoólica = só quem bebe, o resto = todos.
- **RN-64** Item que virou despesa não pode ser reaberto nem removido; a despesa é que se recusa.
- **RN-65** Dois cliques na baixa nunca geram duas despesas.

## Frotas & Caronas (Fase 2)

- **RN-70** Cada pessoa cadastra no máximo um carro por rolê; quem dirige não ocupa lugar em outro carro.
- **RN-71** Cada pessoa ocupa um único lugar por rolê; pegar outro carro libera o anterior. Carro lotado recusa.
- **RN-72** Com sinal exigido, só quem está com o sinal aprovado escolhe lugar (vale também para o General alocar alguém).
- **RN-73** Não se reduzem os lugares abaixo do número de passageiros. Remover o carro devolve os passageiros para "sem lugar" e desaloca a bagagem.
- **RN-74** A bagagem é alocada pelo General da Frota; passar da capacidade de itens grandes do carro gera alerta.
- **RN-75** Motorista (ou General da Frota) tira passageiros; o passageiro afetado é avisado.

## Orçamento e conta

- **RN-80** Custos fixos (casa, hospedagem) são informados pelo General da Base. O valor por pessoa estimado é (custos fixos + mercado estimado) ÷ confirmados, arredondado para cima.
- **RN-81** Exportar os dados é direito da pessoa. Excluir a conta anonimiza o perfil e apaga comprovantes; é recusado se a pessoa organiza rolê ativo, está confirmada em rolê em andamento ou tem acerto pendente (D-022).

## Acesso e conta (D-024)

- **RN-90** O acesso é celular + senha. A senha tem no mínimo 8 e no máximo 72 caracteres, não pode ser comum, repetitiva ou sequência óbvia, nem o próprio celular.
- **RN-91** O cadastro entrega um código de recuperação de 16 caracteres, exibido uma única vez. Só o hash fica no servidor.
- **RN-92** Recuperar com o código redefine a senha, derruba todos os aparelhos e queima o código usado (nasce um novo, mostrado na hora).
- **RN-93** Cinco erros de senha ou de código em 15 minutos bloqueiam o celular até a janela passar. A mensagem de erro é a mesma para celular inexistente e senha errada.
- **RN-94** Cada acesso é uma sessão no servidor, com rótulo do aparelho e último uso. Sair, desconectar um aparelho, trocar a senha ou excluir a conta encerra sessões de imediato; repetir um cookie antigo não vale.
- **RN-95** Trocar a senha ou gerar novo código exige a senha atual. Trocar a senha desconecta os outros aparelhos.

## Avisos internos (D-025)

- **RN-96** Cada aviso pertence a uma categoria (quórum, sinal, cargos, mercado, carros, despesas, acerto e, desde D-037, enquetes e tropa). Quem desligou a categoria na central da conta não recebe os avisos dela, além do silenciamento por rolê (RN-51).
- **RN-97** Todas as categorias começam ligadas. Avisos de tipo desconhecido nunca são silenciados por engano.

## Quartos (D-030)

- **RN-82** Só o General da Base (ou o Idealizador, se vago) cria, edita e remove quartos, e só com o rolê confirmado. Cada quarto tem de 1 a 12 camas.
- **RN-83** Cada pessoa ocupa uma única cama por rolê; pegar outra cama libera a anterior. Quarto lotado recusa.
- **RN-84** Com sinal exigido, só quem está com o sinal aprovado escolhe cama (vale também para o General alocar alguém).
- **RN-85** Não se reduzem as camas abaixo do número de ocupantes. Remover o quarto avisa quem estava nele.

## Termos e retenção (D-028, D-029)

- **RN-98** O cadastro exige o aceite dos termos e da privacidade; guarda data e versão aceitas.
- **RN-99** Comprovantes de sinal e fotos de notas são apagados 90 dias após o encerramento ou cancelamento do rolê. Valores e auditoria permanecem.

- **RN-100** Rolê cancelado com janela de sinal aberta: cada sinal aprovado (exceto o do Tesoureiro) aparece como "a devolver" até o Tesoureiro marcar como devolvido. O app não movimenta dinheiro. Cada pessoa vê só a própria linha; marcar é idempotente e avisa a pessoa.
- **RN-101** Só o Idealizador transfere o comando, a um participante confirmado, e só com o rolê aberto ou confirmado. Não pode transferir para si mesmo.

## Enquete, tropa, Pix e mural (D-037 a D-042)

- **RN-102** Enquete tem de 2 a 6 opções. Cada pessoa marca quantas quiser; refazer o voto troca o anterior. Só o Idealizador encerra, e depois ninguém mais vota.
- **RN-103** Maioria clara vence sozinha e não pode ser contrariada. Empate: o Idealizador escolhe entre as empatadas. Sem votos: escolhe qualquer opção.
- **RN-104** Ao criar o rolê a partir da enquete encerrada (só o dono dela), as duas ficam ligadas e quem votou recebe o aviso com o link do convite. Enquete ainda aberta ou de outra pessoa não é ligada.
- **RN-105** O código Pix copia e cola leva a chave de quem recebe e o valor exato em centavos; só quem paga o acerto o recebe, e só enquanto não foi pago. Sem chave cadastrada, o app avisa e não gera código. O app nunca move dinheiro.
- **RN-106** Tropa: entra só quem abre o link. O dono não sai e é o único que tira gente ou exclui. "Chamar a tropa" avisa uma vez por rolê quem ainda não respondeu e não confirma ninguém.
- **RN-107** Repetir o rolê é só do Idealizador: cria proposta aberta com valor, quórum, sinal, Base, lista de compras, quartos e playlist copiados; não copia cargos, carros, despesas, respostas nem quem já pegou item.
- **RN-108** Conta por item: cada item é dividido só entre os consumidores que estão no rateio; a sobra do valor da despesa é rateada pelo consumo (maior resto, desempate pelo id). A soma das partes é sempre o valor da despesa. Item sem consumidor bloqueia o fechamento.
- **RN-109** Marcar "eu consumi" vale até o rolê ser fechado; por outra pessoa, só quem lançou a despesa ou o Tesoureiro. Só confirmados entram.
- **RN-110** Mural de fotos: só confirmados veem e postam, rolê confirmado ou fechado, até 40 fotos (JPG, PNG ou WebP). Apaga o autor ou o Idealizador.
- **RN-111** Bagagem: itens do grupo só o General da Base (ou o Idealizador, se vago) cria; itens pessoais e as marcações só a própria pessoa vê.
- **RN-112** Trilha: só confirmados sugerem e votam, com o rolê aberto ou confirmado. Links só `http(s)`. Quem sugere já vota na própria música.
- **RN-113** Selo de confiança: "confiável" = 2 ou mais rolês encerrados, nenhum sinal perdido e nenhum acerto atrasado (mais de 7 dias depois do fechamento); "primeira vez" = nenhum rolê encerrado. Só o Idealizador vê, nunca existe selo negativo.
- **RN-114** Relatório de Missão: só confirmados veem; usa só despesas aprovadas; não expõe saldo de ninguém.
- **RN-115** Ao excluir a conta somem as enquetes e tropas criadas, os votos, a bagagem pessoal, as músicas e as fotos da pessoa; os lançamentos financeiros (inclusive a conta por item) ficam.
