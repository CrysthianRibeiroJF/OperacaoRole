# Cérebro da Operação Rolê

Última atualização: 21/10/2026 · Fase: MVP, Fase 2 e Fase 3 (social e retenção) implementados; descoberta com usuários pendente

Esta pasta guarda o que o projeto **sabe e decidiu**. Leia aqui antes de mexer no PRD ou no backlog.

## Índice

| Arquivo | Para que serve | Quando atualizar |
|---|---|---|
| [decisoes.md](decisoes.md) | Registro de decisões (D-001...) com contexto e consequências | Sempre que algo for decidido |
| [regras-de-negocio.md](regras-de-negocio.md) | Regras precisas e testáveis (quórum, sinal, rateio, permissões) | Sempre que uma regra mudar |
| [glossario.md](glossario.md) | Vocabulário do produto (Andorinha, Sinal, General...) | Ao criar um termo novo |
| [questoes-abertas.md](questoes-abertas.md) | Perguntas sem resposta (Q1...), com dono e bloqueios | Ao surgir ou fechar uma dúvida |
| [aprendizados.md](aprendizados.md) | Evidências de usuários, testes e erros | Após entrevistas, betas e incidentes |

Outros documentos: [PRD](../docs/PRD-Operacao-Role.md), [backlog](../docs/BACKLOG.md), [arquitetura](../docs/arquitetura.md).

## Estado em uma olhada

- **Código:** MVP funcional (API, PWA, domínio e contratos) com 160 testes automatizados mais testes de ponta a ponta em desktop, Android e iOS (Playwright). Rodar: ver [README](../README.md). Arquitetura: [docs/arquitetura.md](../docs/arquitetura.md).
- **Tese central:** proposta fechada + massa crítica + sinal Pix + rateio justo resolvem a inércia dos rolês em grupo.
- **Não validado ainda:** o problema e as metas numéricas (nenhuma pesquisa com usuários até agora).
- **Pronto para produção técnica (D-027 a D-031):** um processo serve app e API, CI, termos provisórios com aceite, retenção de 90 dias, quartos e `npm run metrics`.
- **Acesso interno (D-024 a D-026):** celular + senha, código de recuperação, aparelhos conectados, central da conta e avisos só dentro do app. Sem SMS, WhatsApp ou e-mail.
- **Acompanhantes (D-045):** casal e crianças presos à confirmação, cotas em dobro, sinal por cota, capacidade da casa e cama de casal. Pendência: Q18 (dados de crianças).
- **Painéis por cargo (D-043, D-044):** aba Painel (Idealizador, Generals e andorinha), pontos de encontro e plano de transporte. 
- **Fase 3 no ar (D-037 a D-042):** enquete de data e local (com busca de lugares e previsão), Pix copia e cola, Relatório de Missão, repetir rolê, tropa, mural (fotos, bagagem, trilha), agenda .ics, conta por item e selo de confiança. Pendências: Q15 (selo e privacidade) e Q16 (retenção das fotos).
- **Fase 2 no ar (D-020 a D-023):** Mercado, Frotas, orçamento, previsão do tempo, prévia de link e exclusão de conta.
- **Decididas (D-009 a D-013):** sinal opcional, sem custódia, rolê confirmado não desconfirma, sorteio com teto de 2 cargos, PWA.
- **Pendências que bloqueiam um lançamento público:** parecer jurídico do sinal e revisão dos termos (Q12 / ROL-004 / ROL-123) e contatos de privacidade.
- **Próximo marco:** entrevistas e beta fechado com 10 grupos (ROL-001, ROL-124).

## Princípios inegociáveis

1. O app não custodia dinheiro (D-003).
2. Cobrança é privada, nunca expõe devedor ao grupo (D-005).
3. Convidado abre o link sem instalar nada (D-004).
4. Todo valor financeiro é auditável a partir dos lançamentos (D-007).
