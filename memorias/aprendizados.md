# Aprendizados

Evidências reais: entrevistas, testes de protótipo, beta e incidentes. Ainda **não há dados**: todas as metas do PRD são hipóteses.

## Como registrar

Uma entrada por fonte, com data, o que foi observado (fatos, não interpretação), o que isso muda e a ação gerada.

```
### AP-001 · <título curto> · AAAA-MM-DD · Fonte: <entrevista / teste / beta / incidente>
**Observado:** ...
**Implicação:** ... (afeta D-00X / RN-XX / ROL-XXX)
**Ação:** ...
```

## Hipóteses a validar (fonte: PRD v0.1)

| # | Hipótese | Como validar | Status |
|---|---|---|---|
| H1 | Organizadores sofrem com carga mental e cobrança em rolês de grupo | ROL-001 | Não validada |
| H2 | 3 confirmados bastam para o resto do grupo decidir "ficar de fora" | ROL-002, beta | Não validada |
| H3 | Pessoas pagam sinal por Pix antes do rolê se isso garante a vaga | ROL-001, beta | Não validada |
| H4 | Um Tesoureiro aceita validar comprovantes manualmente | ROL-001 | Não validada |
| H5 | Convidados respondem a um link sem instalar nada | Beta | Não validada |
| H6 | Cobrança automática e impessoal é aceita, e preserva a amizade | Beta | Não validada |

## Entradas

### AP-001 · Local da enquete deve usar a busca e mostrar o tempo · 2026-10-21 · Fonte: feedback do dono do produto
**Observado:** ao descrever a enquete, o pedido foi que, ao escolher o local, já houvesse a busca de lugares e a previsão do tempo na hora, e não só depois do rolê criado.
**Implicação:** o campo de destino ganhou autocomplete (Open-Meteo) e a previsão aparece ao lado das datas, na enquete, em "Lançar um rolê" e em "Repetir esse rolê" (D-037). Vale testar com usuários se a previsão realmente pesa na escolha.

### AP-002 · Cada General quer a sua tela; e casais não cabem no modelo · 2026-10-21 · Fonte: feedback do dono do produto
**Observado:** pediu que cada General tenha uma tela mais avançada (compras com mais detalhe, caronas com local de encontro, Uber e paradas), que o Idealizador veja tudo e que a andorinha sem cargo tenha um painel de acompanhamento. Em seguida perguntou como ficam casais: divisão de quartos, mais de um casal por rolê e casal pagando em dobro.
**Implicação:** a aba Painel e os pontos de encontro (D-043, D-044) respondem à primeira parte. A segunda mostra uma lacuna do modelo "uma confirmação = uma pessoa" (Q17): afeta rateio, quórum, sinal, quartos e carros e precisa de decisão antes de construir.

### AP-003 · Casais precisam de um lugar no modelo · 2026-10-21 · Fonte: feedback do dono do produto
**Observado:** definiu que o acompanhante conta como "andorinha atrelada" só para contar a cabeça (principalmente pela capacidade da casa), que quem confirma com casal paga por dois, que o casal não é ligado à conta e sim ao rolê, e que criança é isenta com limite para não virar creche.
**Implicação:** D-045 e RN-124 a RN-130. A capacidade da casa em cabeças virou regra do rolê. Vale validar no beta se um adulto só por confirmação basta e se 2 crianças é um bom padrão.
