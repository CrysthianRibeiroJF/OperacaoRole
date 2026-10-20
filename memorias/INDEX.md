# Cérebro da Operação Rolê

Última atualização: 20/10/2026 · Fase: MVP técnico implementado; descoberta com usuários pendente

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

- **Código:** MVP funcional (API, PWA, domínio e contratos) com 73 testes automatizados. Rodar: ver [README](../README.md). Arquitetura: [docs/arquitetura.md](../docs/arquitetura.md).
- **Tese central:** proposta fechada + massa crítica + sinal Pix + rateio justo resolvem a inércia dos rolês em grupo.
- **Não validado ainda:** o problema e as metas numéricas (nenhuma pesquisa com usuários até agora).
- **Decididas (D-009 a D-013):** sinal opcional, sem custódia, rolê confirmado não desconfirma, sorteio com teto de 2 cargos, PWA.
- **Pendências que bloqueiam um lançamento público:** parecer jurídico do sinal (Q12 / ROL-004), provedor de SMS/WhatsApp (Q11), LGPD (ROL-121) e termos de uso (ROL-123).
- **Próximo marco:** entrevistas e beta fechado com 10 grupos (ROL-001, ROL-124).

## Princípios inegociáveis

1. O app não custodia dinheiro (D-003).
2. Cobrança é privada, nunca expõe devedor ao grupo (D-005).
3. Convidado abre o link sem instalar nada (D-004).
4. Todo valor financeiro é auditável a partir dos lançamentos (D-007).
