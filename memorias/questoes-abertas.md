# Questões em aberto

Ao responder uma questão: registre a decisão em [decisoes.md](decisoes.md), mova a linha para "Resolvidas" e atualize as regras e tickets afetados.

## Bloqueantes (antes de construir)

Nenhuma. Q1 a Q5 foram resolvidas em 20/10/2026 (ver "Resolvidas"). **Atenção:** a resposta de Q2 é uma premissa de produto e não substitui o parecer jurídico (Q12).

## Não bloqueantes

| ID | Pergunta | Dono | Proposta atual |
|---|---|---|---|
| Q6 | A lista de devedores é visível a todos? | Design/Produto | Privada (Tesoureiro e o próprio devedor) |
| Q8 | Fonte dos preços médios? | Dados | Tabela editável pelo General de Suprimentos no início |
| Q9 | Modelo de monetização? | Negócio | Gratuito no MVP; avaliar depois |
| Q10 | Múltiplos Idealizadores ou transferência do cargo? | Produto | Transferência manual (P1) |
| Q12 | Parecer jurídico: o app pode ser enquadrado como intermediador de pagamento ao registrar sinais? Qual a regra de reembolso? (herdada de Q2) | Jurídico | Manter sem custódia e só orientar |
| Q13 | Quem bebe, mas não pagou o sinal, deve ficar fora do rateio de bebida? (hoje fica: roster = quite com o sinal) | Produto | Manter; revisar com dados do beta |
| Q14 | O limite que exige aprovação de despesa (hoje R$ 300) deve ser configurável por rolê? | Produto | Sim, na Fase 2 |
| Q15 | O selo "Andorinha confiável" (histórico de sinal e acerto por pessoa, visível só ao Idealizador) cabe na base legal e na política de privacidade? | Jurídico | Manter só o lado positivo; incluir na revisão de privacidade (ROL-121) |
| Q16 | Por quanto tempo guardar as fotos do mural? Hoje ficam até o autor apagar ou excluir a conta (não entram na limpeza de 90 dias). | Produto/Jurídico | Definir no beta, junto da retenção (D-029) |

## Resolvidas

| ID | Pergunta | Resposta | Decisão |
|---|---|---|---|
| Q1 | Sinal opcional ou obrigatório? | Opcional por rolê; abre ao confirmar | D-009 |
| Q2 | Responsabilidade legal do sinal | Sem custódia; parecer jurídico segue pendente (Q12) | D-010 |
| Q3 | Queda abaixo do quórum depois de confirmado | Permanece confirmado + alerta | D-011 |
| Q4 | Sorteio de cargos | Só vagos, teto de 2 cargos, quem larga não repete | D-012 |
| Q5 | PWA ou nativo | PWA (React + Vite + Fastify) | D-013 |
| Q7 | Canal principal de notificação (push web é fraco no iOS) | Só dentro do app, sem canal externo | D-025 |
| Q11 | Provedor de SMS/WhatsApp para login e avisos | Nenhum por ora: acesso por celular e senha, avisos internos | D-024, D-025 |
