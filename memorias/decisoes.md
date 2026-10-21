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

## D-018 · Login por telefone com código (OTP) · 20/10/2026 · Substituída por D-024
**Decisão:** sessão por cookie `httpOnly`, `SameSite=Lax`, 30 dias. O envio do código passa pela interface `OtpSender`; em desenvolvimento o código é impresso no console e devolvido na resposta (`OTP_DEV_ECHO`). Em produção, o servidor recusa subir com esse eco ligado e o envio falha explicitamente até existir um provedor real (Q11).

## D-019 · Direção visual "ordem de missão" · 20/10/2026 · Aceita
**Contexto:** a primeira versão (bege, verde-petróleo e coral) era a combinação genérica de app de viagem e não carregava a ideia do produto.
**Decisão:** o rolê é tratado como uma operação. O **bilhete com picote** (número de série em mono) é o objeto central do feed, do convite e do saldo. A massa crítica é o **medidor de andorinhas** (vagas que se preenchem) e o momento memorável é o **carimbo "Confirmado"** que cai quando o quórum fecha. Paleta: tinta de carimbo (navy `#0e1f3d`), sol (`#ffc72c`, a única cor de ação), carimbo (`#e0402a`, só para o que é definitivo) e uma mesa azul-acinzentada. Tipografia: Big Shoulders Display (títulos condensados em caixa-alta), Instrument Sans (texto) e IBM Plex Mono (códigos, prazos e valores), todas hospedadas no próprio app. Botões de ação são "teclas" com espessura. Ícones em SVG próprio (sem emojis na interface). Modo escuro automático pelos mesmos tokens.
**Consequências:** o amarelo só aparece na ação principal de cada tela. O carimbo e o bilhete não devem virar enfeite: carimbo só em decisões (confirmado), bilhete só para rolês e saldo. As cores vivem como tokens em `apps/web/src/styles.css`; nada de hex solto nos componentes.

## D-020 · Fase 2 entra no ar: Mercado, Frotas, orçamento e clima · 20/10/2026 · Aceita
**Contexto:** o MVP provava a tese (quórum, sinal, rateio), mas a operação do rolê (quem leva o quê, quem vai com quem) ainda era no WhatsApp.
**Decisão:** o QG ganha as abas **Mercado** e **Frotas** (agora são cinco). A lista de mercado nasce de uma sugestão por pessoas, consumo e dias (`suggestSupplies`), tem "eu levo" para qualquer confirmado e a baixa pode virar despesa com a cota da categoria (carne só entre quem come carne, cerveja só entre quem bebe). Frotas tem carros com lugares estilo mapa de avião, bagagem por carro com alerta de excesso e alocação pelo General da Frota. O simulador de orçamento soma custos fixos + mercado e mostra o valor por pessoa caindo conforme entra gente. A previsão do tempo vem do Open-Meteo.
**Consequências:** o fallback do Idealizador (D-014) agora cobre os quatro cargos enquanto vagos. Quem tem sinal pendente não escolhe lugar no carro (RN-14 passou a valer de verdade).

## D-021 · Previsão do tempo chamada do navegador · 20/10/2026 · Aceita
**Decisão:** o app consulta o Open-Meteo (sem chave) direto do navegador, só com o nome da cidade. Se falhar, o cartão some. Só existe previsão a até 16 dias do rolê; antes disso o cartão informa quando ela aparece.
**Consequências:** nenhum dado de pessoa sai do app. Em produção, a política de segurança do site precisa liberar `geocoding-api.open-meteo.com` e `api.open-meteo.com`.

## D-022 · Exclusão de conta por anonimização · 20/10/2026 · Aceita
**Contexto:** LGPD pede que a pessoa possa levar e apagar seus dados, mas os lançamentos financeiros dos grupos dependem dela.
**Decisão:** há exportação em JSON e exclusão por anonimização (nome, telefone, Pix e comprovantes somem; os valores dos rolês ficam sem identificação). A exclusão é recusada enquanto a pessoa organiza rolê ativo, está confirmada em rolê em andamento ou tem acerto pendente. Sessões de conta excluída deixam de valer na hora.
**Consequências:** falta definir retenção automática de comprovantes e o consentimento no cadastro (ROL-121 segue parcial).

## D-023 · Link compartilhado com prévia (Open Graph) · 20/10/2026 · Aceita
**Decisão:** o botão de compartilhar usa `/share/:code`, uma página mínima com título, descrição e imagem Open Graph (WhatsApp lê só o HTML) que redireciona o humano para o convite. Só dados públicos do convite.
**Consequências:** em produção, `/share` e `/api` precisam sair da mesma origem do app (proxy reverso). A imagem é a mesma para todos os rolês; uma imagem com o texto do rolê fica como evolução.

## D-024 · Acesso interno: celular e senha, sem SMS, WhatsApp ou e-mail · 20/10/2026 · Aceita (substitui D-018)
**Contexto:** o login por código dependia de um provedor de SMS que o projeto decidiu não integrar por enquanto. Sem ele, ninguém conseguia entrar fora do desenvolvimento.
**Decisão:** o acesso é **celular + senha**. Senha com política em português (mínimo 8, sem comuns nem sequências, diferente do celular) e guardada com scrypt e sal. Como não há canal para recuperar a conta, o cadastro entrega um **código de recuperação** de 16 caracteres, mostrado uma vez e só confirmado quando a pessoa marca que guardou; usar o código redefine a senha, derruba todos os aparelhos e emite um novo. Sessões ficam no servidor, uma por aparelho (rótulo como "Chrome no Android"), e podem ser encerradas uma a uma ou todas as outras; trocar a senha derruba os demais aparelhos. Erros de senha ou de código bloqueiam o celular por 15 minutos depois de 5 tentativas. O celular **não é verificado**: serve só como identificador.
**Consequências:** quem perde a senha e o código não tem como recuperar a conta (a mensagem avisa isso). Alguém pode cadastrar o celular de outra pessoa antes dela; o dano é pequeno (nenhum rolê entra sem o link do convite) e entra no risco registrado. A tabela de códigos por SMS foi removida (migration 003).

## D-025 · Todos os avisos são internos ao app · 20/10/2026 · Aceita
**Decisão:** nenhum canal externo por ora. Os avisos vivem na aba **Avisos** (caixa de entrada com filtros por categoria, agrupamento por dia, atalho para a aba certa do QG e "marcar lidos") e no selo da navegação e do título da aba do navegador. A pessoa escolhe as categorias que quer receber em **Conta > Avisos** e pode reativar rolês silenciados.
**Consequências:** sem push, quem não abre o app não é lembrado. Isso aumenta o peso de quórum, sinal e cobrança como avisos dentro do app; a tabela `notifications` continua pronta para virar fila de saída quando houver um canal externo.

## D-026 · Central da conta · 20/10/2026 · Aceita
**Decisão:** `/perfil` vira um menu com credencial no topo e quatro áreas: Dados pessoais, Avisos, Segurança e acessos, Privacidade e dados. A navegação inferior chama-se "Conta".

## D-027 · Um processo serve o app e a API · 20/10/2026 · Aceita
**Decisão:** em produção a API entrega o app compilado (`apps/web/dist`) com fallback de SPA para as rotas do React Router; `/api` e `/share` continuam da API. Arquivos com hash no nome são imutáveis (`max-age` de 1 ano); `index.html` e o service worker sempre revalidam. A política de segurança (CSP) é a padrão do Helmet mais `connect-src` para os dois domínios do Open-Meteo.
**Consequências:** uma origem só (cookie de sessão, prévia do link e PWA funcionam sem proxy). Há CI (GitHub Actions) e um Dockerfile, este ainda não executado por falta de Docker no ambiente.

## D-028 · Termos e privacidade provisórios, com aceite versionado · 20/10/2026 · Aceita
**Decisão:** páginas públicas `/termos` e `/privacidade` em linguagem simples, marcadas como texto provisório em revisão jurídica. O cadastro exige o aceite e grava data e versão (`TERMS_VERSION`).
**Consequências:** o texto **não substitui** a revisão jurídica (Q12, ROL-004); contatos ficam "a definir". Mudou o texto de forma relevante? Suba a versão e peça novo aceite.

## D-029 · Retenção de arquivos: 90 dias · 20/10/2026 · Aceita
**Decisão:** comprovantes de sinal e fotos de notas são apagados 90 dias depois que o rolê é encerrado ou cancelado, por um job agendado no fechamento ou no cancelamento. Valores, saldos e trilha de auditoria ficam.
**Consequências:** quem precisar da imagem deve baixá-la antes. O prazo está em `FILE_RETENTION_DAYS`.

## D-030 · Quartos na aba Base · 20/10/2026 · Aceita
**Decisão:** o General da Base (ou o Idealizador, se vago) monta quartos com número de camas. Qualquer confirmado pega a própria cama, com a mesma trava do sinal dos carros (RN-14). Uma cama por pessoa por rolê; trocar de quarto libera a anterior.
**Consequências:** completa a RN-14 e o PRD (distribuição de quartos). Não há aba nova: o cartão fica na Base.

## D-031 · Métricas do PRD por linha de comando · 20/10/2026 · Aceita
**Decisão:** `npm run metrics` calcula direto do banco os indicadores G1 a G5 e o sinal aprovado, com as metas ao lado (`--json` para máquinas). Sem dados, devolve "sem dados" em vez de número inventado.
**Consequências:** serve ao beta sem ferramenta externa. Não é analytics de funil (cliques, telas); isso segue em aberto (ROL-013).

## D-032 · Desktop, Android e iOS com uma base só · 20/10/2026 · Aceita
**Decisão:** continuar PWA (sem apps nativos). Piso de navegadores: iOS Safari 16.4, Chrome/Edge 111, Firefox 128 (imposto pelo Tailwind v4 e declarado no build). Layout de celular com barra inferior e, a partir de 1024 px, menu lateral e grades em duas colunas. Instalação guiada (botão no Android/desktop, passo a passo no iOS), ícones maskable e apple-touch, áreas seguras de notch, fotos reduzidas e convertidas no aparelho antes do envio. Validação com Playwright em desktop, Pixel (Chromium), iPhone e iPad (WebKit).
**Consequências:** o WebKit do Playwright não substitui um iPhone real (teclado, câmera, instalação): teste manual obrigatório antes de divulgar. Sem push no iOS/Android enquanto não houver canal externo (D-025). Detalhes: `docs/testes-de-plataforma.md`.

## D-033 · Monitoramento de erros e funil dentro do próprio app · 20/10/2026 · Aceita
**Decisão:** erros do servidor (500) e do app (ErrorBoundary, `error`, `unhandledrejection`, no máximo 5 por sessão) e eventos do funil (`invite_viewed`, `signup_started`, `share_clicked`, `install_shown`, `install_accepted`) vão para tabelas próprias (migration 005), sem serviço externo. Aparecem em `npm run errors` e em `npm run metrics`. Nomes de evento são uma lista fechada; nada além do id do usuário logado é guardado.
**Consequências:** serve ao beta sem custo nem terceiros e combina com a LGPD. Não alerta sozinho: alguém precisa olhar. Se o volume crescer, trocar por serviço dedicado.

## D-034 · Devolução do sinal é só registro · 20/10/2026 · Aceita
**Decisão:** em rolê cancelado com janela de sinal aberta, o Tesoureiro devolve cada sinal aprovado por Pix, **fora do app**, e marca "devolvido" aqui. Cada pessoa vê só a própria linha e é avisada. Reforça D-003 (o app não custodia dinheiro).
**Consequências:** sem prazo nem multa automáticos. Q1/Q2 (política de reembolso) seguem para o parecer jurídico.

## D-035 · Passar o comando do rolê · 20/10/2026 · Aceita
**Decisão:** o Idealizador pode transferir o comando a um participante **confirmado**, com rolê aberto ou confirmado. O novo Idealizador passa a cobrir cargos vagos; o anterior segue na tropa. Ambos são avisados.
**Consequências:** fecha a lacuna de o organizador sumir. Não há transferência forçada por terceiros.

## D-036 · Publicação no Render · 20/10/2026 · Aceita
**Decisão:** um serviço web Node com disco persistente (SQLite e comprovantes em `/var/data`), descrito em `render.yaml`. Instância única; plano pago por causa do disco. Backup: snapshots do Render mais `npm run backup`.
**Consequências:** sem escala horizontal enquanto for SQLite; migrar para Postgres antes disso. Guia: `docs/publicar-no-render.md`.

## D-037 · Enquete de data e local antes da proposta · 21/10/2026 · Aceita
**Contexto:** o rolê nasce como cartão fechado, mas muitos grupos ainda não sabem data nem lugar.
**Decisão:** a Enquete (`/enquete/:code`) tem de 2 a 6 opções (lugar e datas); cada pessoa pode marcar **mais de uma** (aprovação, como numa enquete de datas). O Idealizador encerra: maioria clara vence sozinha; em empate (ou sem votos) ele escolhe entre as empatadas. A vencedora abre "Lançar um rolê" já preenchido e a proposta criada fica ligada à enquete, avisando quem votou. O link abre sem login (leitura); votar exige conta.
**Consequências:** nova rota pública de leitura (`GET /api/polls/:code`, na lista de exceções do teste de guarda). O campo de lugar usa a busca de lugares e mostra a previsão do tempo por opção (D-021 estendida: geocodificação do Open-Meteo, a mesma da previsão; só o texto digitado sai do app).

## D-038 · Pix copia e cola gerado no app, sem custódia · 21/10/2026 · Aceita
**Decisão:** o app monta o código Pix (BR Code estático, CRC16) com a chave e o valor certos, para o acerto de contas (`GET /api/transfers/:id/pix`, só para quem paga) e para o sinal (`GET /api/events/:id/deposit/pix`). Nada de QR nem de pagamento dentro do app.
**Consequências:** reforça D-003: o dinheiro sai direto do banco de quem paga para o de quem recebe; o app só entrega texto. Chaves digitadas com máscara são normalizadas (telefone vira +55, CPF só números). Se o credor não tem chave, o botão avisa e o combinado segue por fora.

## D-039 · Tropa entra por consentimento · 21/10/2026 · Aceita
**Decisão:** Tropa é um grupo fixo de amigos. Entra quem abre o link e aceita; ninguém é colocado por terceiros. "Chamar a tropa" é só um **aviso interno** com o link do convite, uma vez por rolê e só para quem ainda não respondeu. O dono não sai (exclui a tropa); só ele tira membros.
**Consequências:** sem canal externo (D-024/D-025). Evita spam e cadastro de terceiros por número de celular.

## D-040 · Selo "Andorinha confiável" só para o Idealizador · 21/10/2026 · Aceita (revisar no jurídico, Q15)
**Decisão:** o Idealizador vê, na lista da tropa, "confiável" (2 ou mais rolês encerrados, nenhum sinal perdido, nenhum acerto atrasado) ou "primeira vez". **Não existe selo negativo** e os demais participantes nunca o recebem. Atraso = pagar depois de 7 dias do fechamento ou seguir devendo depois dele.
**Consequências:** reduz pipoca sem expor ninguém (D-005). É um tratamento de dados novo (histórico por pessoa): precisa constar na revisão de privacidade antes do lançamento público (Q15).

## D-041 · Conta por item · 21/10/2026 · Aceita
**Decisão:** uma despesa pode ter itens (nome, valor, quem consumiu). A despesa continua guardada como "pessoas específicas"; as partes vêm dos itens: cada item divide só entre os consumidores e a sobra do total (taxa, gorjeta, item sem dono) é rateada na proporção do consumo (maior resto, sem perder centavo). Cada pessoa marca ou desmarca o próprio nome até a conta fechar; quem lançou (e o Tesoureiro) marca por outros. Item sem nenhum consumidor vira pendência que bloqueia o fechamento.
**Consequências:** o motor de rateio ganhou o campo `shares` (partes exatas); a invariante "soma dos saldos = 0" segue valendo e tem teste. "Dividir só com quem participou" (outra ideia) já existia como a cota "Pessoas específicas".

## D-042 · Mural do rolê (fotos, bagagem, trilha), agenda e relatório · 21/10/2026 · Aceita
**Decisão:** nova aba **Mural** no QG. Fotos: só confirmados veem e postam, até 40 por rolê, só imagem, comprimidas no aparelho; o autor ou o Idealizador apaga. Bagagem: sugestões do General da Base para todos e lista pessoal que só o dono vê. Trilha: link da playlist (Base) e sugestões de música com voto. Agenda: arquivo `.ics` do rolê (aviso um dia antes). **Relatório de Missão:** totais, média por cabeça, quem mais adiantou, maior despesa e categoria líder, sem saldo individual; vira definitivo com a conta fechada; compartilhável como imagem. "Repetir esse rolê" cria proposta nova reaproveitando valor, quórum, sinal, Base, lista de compras, quartos e playlist (cargos, carros, despesas e respostas começam do zero).
**Consequências:** as fotos do mural **não** entram na limpeza de 90 dias (RN-99) porque são o objetivo do mural; saem quando o autor apaga ou exclui a conta (Q16).

## D-043 · Painel por cargo na aba "Painel" · 21/10/2026 · Aceita
**Contexto:** cada General tinha só as abas comuns; faltava uma tela de acompanhamento da própria área, e quem não tem cargo não via o próprio andamento.
**Decisão:** nova aba **Painel**, a primeira do QG, que muda conforme quem entra. O Idealizador vê a **visão geral** (prontidão por área e alertas) e o painel de todos os cargos; cada General vê o painel do próprio cargo (Mercado em detalhe por categoria, quem leva o quê e o que falta dono; Frota com cobertura, lugares, Uber, pontos e horários; Base e Tesouro mais enxutos); toda andorinha vê o **Meu acompanhamento** (passos pendentes, sinal, transporte, cama, itens, bagagem e a parte dela da conta). O servidor decide o que cada um recebe (`can()` com as ações `panel.*`); o app só mostra o que veio.
**Consequências:** o painel só lê: editar continua nas abas de cada área (RN-25 vale). A prontidão é uma média simples das áreas e não é meta do produto.

## D-044 · Pontos de encontro e plano de transporte · 21/10/2026 · Aceita
**Decisão:** o General da Frota cadastra pontos de encontro, paradas, o local para chamar o app (Uber, 99, táxi) e a volta, com horário e endereço opcionais; a turma é avisada ao criar e quando hora, local ou nome mudam. Quem não tem lugar no carro declara "vou de app" (com estimativa opcional da corrida) ou "por conta própria". O lugar no carro sempre vale mais que o plano.
**Consequências:** a corrida de app é **informativa** e não entra no rateio (D-003, sem mover dinheiro). Repetir o rolê copia os pontos.
