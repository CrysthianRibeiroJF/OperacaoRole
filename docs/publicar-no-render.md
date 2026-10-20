# Publicar a Operação Rolê no Render

Guia passo a passo para colocar o app no ar. O arquivo [`render.yaml`](../render.yaml) na raiz já descreve tudo; este guia explica o porquê e o que fazer à mão.

> **Antes de abrir para o público** (CLAUDE.md): parecer jurídico (Q12), termos de uso (ROL-123), LGPD (ROL-121) e provedor de OTP (Q11) precisam estar fechados. Para um teste fechado com amigos, dá para publicar já; só não divulgue o link amplamente.

## 1. Como o app roda lá

- **Um serviço só.** A API (Fastify) serve também o app compilado (`apps/web/dist`), então `/`, `/api`, `/share` e o PWA ficam na mesma origem. Não há "static site" separado.
- **Banco SQLite + comprovantes em disco.** Por isso o serviço precisa de um **Disco Persistente** do Render, montado em `/var/data`. Sem disco, o banco é apagado a cada deploy/reinício.
- **Uma instância apenas.** SQLite não é compartilhado entre servidores. Não ative escala horizontal (mais de 1 instância).
- **Plano:** disco persistente só existe em planos pagos (a partir do **Starter**, cerca de US$ 7/mês mais o disco, confira os preços atuais no painel). O plano gratuito hiberna e perde dados: serve só para olhar a tela, nunca para o banco real.

> **Só para testar, sem pagar:** use [`render.free.yaml`](../render.free.yaml) (em **New → Blueprint**, informe esse arquivo em "Blueprint file path"). Funciona no plano gratuito, mas **sem disco**: o banco e os comprovantes são apagados a cada reinício ou deploy, e o serviço dorme após uns 15 minutos parado. Nunca use para dados reais.

## 2. Passo a passo

1. **Suba o código para o GitHub** (o projeto ainda não tem remoto):
   ```bash
   git remote add origin https://github.com/SEU_USUARIO/operacao-role.git
   git push -u origin main
   ```
   Repositório privado funciona. `.env`, banco e uploads já estão no `.gitignore`.
2. No Render: **New → Blueprint**, conecte sua conta do GitHub e escolha o repositório. O Render lê o `render.yaml` e propõe o serviço `operacao-role` com o disco `role-data`.
3. Em `PUBLIC_WEB_URL` (pede o valor porque está como `sync: false`), coloque a URL que o serviço vai ter, por exemplo `https://operacao-role.onrender.com`. Se ainda não souber o endereço exato, coloque qualquer `https://…` agora e corrija depois (passo 4).
4. Clique em **Apply**. O primeiro build leva alguns minutos. Quando terminar, abra a URL do serviço. Se o endereço for diferente do que você digitou, vá em **Environment**, ajuste `PUBLIC_WEB_URL` e salve (o Render reinicia sozinho).
5. Confira `https://SEU-SERVICO.onrender.com/api/health`: deve responder `{"ok":true}`.
6. Crie sua conta pelo próprio app (cadastro com celular e senha) e guarde o **código de recuperação** que aparece uma única vez.

As migrations rodam sozinhas na inicialização (`server.ts`). Não precisa de comando de banco.

## 3. Variáveis de ambiente

| Variável | Valor | Observação |
| --- | --- | --- |
| `NODE_ENV` | `production` | Ativa cookie `Secure`, CSP estrita e proxy confiável (IP real nos limites de uso). |
| `HOST` | `0.0.0.0` | Obrigatório no Render, senão o serviço não recebe tráfego. |
| `PORT` | (o Render define) | Não configure. O app lê a porta que o Render injeta. |
| `SESSION_SECRET` | gerado pelo Render | Mínimo 32 caracteres. **Nunca troque depois**: derruba todas as sessões e invalida os códigos de recuperação já emitidos. Guarde uma cópia num cofre de senhas. |
| `DATABASE_PATH` | `/var/data/role.db` | Dentro do disco. |
| `UPLOAD_DIR` | `/var/data/uploads` | Dentro do disco. |
| `PUBLIC_WEB_URL` | `https://…` | URL pública, usada nos links de convite e na prévia de link (`/share/:code`). |
| `NODE_VERSION` | `22` | O projeto exige Node 22 ou mais novo. |
| `EXPENSE_APPROVAL_THRESHOLD_CENTS` | opcional | Padrão 30000 (R$ 300). |

## 4. Domínio próprio e HTTPS

HTTPS vem de graça no endereço `onrender.com` e nos domínios próprios. Em **Settings → Custom Domains**, adicione o domínio e crie no seu provedor de DNS o registro que o Render indicar (CNAME para subdomínio, ou A/ALIAS para raiz). Depois **atualize `PUBLIC_WEB_URL`** para o domínio novo. O PWA só instala em HTTPS; no iPhone, a instalação é pelo Safari (Compartilhar → Adicionar à Tela de Início).

## 5. Atualizar o app

Com `autoDeploy: true`, cada `git push` na `main` gera um deploy. Os testes rodam no GitHub Actions (`.github/workflows/ci.yml`); para só publicar quando o CI passar, em **Settings → Build & Deploy → Auto-Deploy** escolha "After CI Checks Pass". Com disco, cada deploy tem uns segundos fora do ar (o disco não monta em duas instâncias ao mesmo tempo): evite horários de pico.

## 6. Cópia de segurança

- O Render tira **snapshots automáticos diários** do disco (retenção de 7 dias nos planos pagos) e permite restaurar pelo painel (**Disks → Snapshots**). Restaurar substitui o conteúdo do disco, então anote antes o que mudou.
- Para uma cópia sua, guardada fora do Render, entre pelo **Shell** do serviço e rode `npm run backup` (gera `/var/data/backup-AAAA-MM-DD.db`, consistente mesmo com o app no ar). Baixe o arquivo antes de mudanças grandes. Comprovantes (`/var/data/uploads`) entram no snapshot do disco.

## 7. Operação do dia a dia

No **Shell** do serviço (menu do serviço → Shell), a partir da raiz do projeto:

```bash
npm run metrics   # ativação, retenção, funil e erros das últimas 24 h
npm run errors    # últimos erros do servidor e do app
npm run backup    # cópia do banco
```

Os logs (Logs no painel) mostram uma linha por requisição e as falhas do servidor. Ative alertas de falha de deploy e de health check em **Notifications**. Para ser avisado se o app cair, configure um monitor externo gratuito (UptimeRobot, por exemplo) apontando para `/api/health`.

## 8. Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Build falha em `tsup`/`vite` ("command not found") | `NODE_ENV=production` faz o `npm ci` pular as dependências de build. Use `npm ci --include=dev` (já está no `render.yaml`). |
| Erro ao abrir `better-sqlite3` / "invalid ELF header" | Binário nativo errado. Mantenha `npm rebuild better-sqlite3` no build e `NODE_VERSION=22`. |
| "Configuração inválida: SESSION_SECRET…" | A variável ficou vazia ou com menos de 32 caracteres. |
| Serviço sobe mas dá "No open ports detected" | Falta `HOST=0.0.0.0`. |
| Login funciona e logo cai | Domínio sem HTTPS ou `PUBLIC_WEB_URL` errado; o cookie é `Secure` em produção. |
| Dados sumiram após o deploy | Serviço sem disco, ou `DATABASE_PATH`/`UPLOAD_DIR` fora de `/var/data`. |
| Primeiro acesso demora ~30 s | Só no plano gratuito (hibernação). No Starter o serviço fica sempre ligado. |

## 9. Lista de verificação do lançamento

- [ ] Disco `role-data` montado em `/var/data` e plano pago.
- [ ] `PUBLIC_WEB_URL` igual ao endereço real.
- [ ] `/api/health` responde `ok`.
- [ ] Cadastro, login e convite funcionam no celular (Android e iPhone) e no desktop.
- [ ] Foto de comprovante sobe e reabre (prova de que `UPLOAD_DIR` está no disco).
- [ ] Um deploy de teste não apaga os dados criados antes.
- [ ] Snapshot do disco existe (aguarde o primeiro dia) e você sabe restaurar.
- [ ] Parecer jurídico, termos, LGPD e OTP fechados antes de divulgar.
