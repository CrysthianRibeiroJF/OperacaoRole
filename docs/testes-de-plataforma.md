# Suporte a plataformas e testes de ponta a ponta

O app é um PWA: roda no navegador e pode ser instalado na tela inicial. Uma base só atende desktop, Android e iOS.

## Navegadores e aparelhos suportados

| Plataforma | Mínimo | Como instalar |
| --- | --- | --- |
| iPhone e iPad | iOS/iPadOS 16.4 (Safari) | Compartilhar > Adicionar à Tela de Início (o app mostra o passo a passo) |
| Android | Chrome 111 | Botão "Instalar" do app (ou menu do Chrome) |
| Desktop | Chrome ou Edge 111, Firefox 128, Safari 16.4 | Ícone de instalar na barra de endereço |

O piso vem do Tailwind v4 (usa recursos de CSS recentes). Abaixo disso o app mostra uma mensagem em vez de uma tela em branco. O build é gerado para `es2022`, `chrome111`, `safari16.4`, `firefox128` e `edge111`.

## O que cada plataforma recebe

- **Layout adaptável:** celular com barra de navegação embaixo; a partir de 1024 px, menu lateral fixo, grades em duas colunas (feed, Criar rolê com prévia, abas do QG) e entrada em duas colunas.
- **Tela com notch:** `viewport-fit=cover` e margens `env(safe-area-inset-*)`.
- **Ícones:** 192, 512, maskable (Android) e `apple-touch-icon` de 180 px (iOS), mais imagem de prévia `og.png`.
- **Modo claro e escuro** seguindo o sistema, também na barra do navegador (`theme-color`).
- **Fotos de câmera:** reduzidas a 2000 px e convertidas para JPEG no aparelho antes do envio (inclui HEIC do iPhone quando o navegador decodifica), para respeitar o limite de 5 MB.
- **Instalação:** aviso no feed, dispensável por 14 dias.

## Testes automatizados (Playwright)

```bash
npm run build          # o teste usa o app compilado
npm run e2e            # roda os 4 perfis
npm run e2e -w @role/web -- --project=iphone   # um perfil só
```

Perfis: **desktop-chrome** (1280x800), **android-pixel** (Pixel 7, Chromium), **iphone** (iPhone 14, WebKit) e **ipad** (iPad, WebKit). Cada um sobe um banco temporário com os dados de demonstração e a API compilada servindo o app (`apps/web/e2e/start-server.mjs`), e confere:

- entrada, cadastro com código de recuperação, convite sem login, as abas do QG e as páginas legais;
- menu lateral no desktop e barra inferior no celular;
- **nenhuma rolagem horizontal** em nenhuma tela;
- nenhum erro no console.

As capturas de tela ficam em `apps/web/e2e/screenshots/` (fora do Git).

### O que isso prova e o que não prova

WebKit do Playwright **não é um iPhone de verdade**: valida layout e comportamento do motor do Safari, mas não cobre teclado virtual, câmera/HEIC, instalação na tela inicial nem o comportamento do iOS em segundo plano. Antes de divulgar, teste à mão num iPhone e num Android reais: cadastro, convite pelo link do WhatsApp, anexar foto de comprovante e instalar o app.

O WebKit no Windows às vezes demora na primeira carga; por isso há uma nova tentativa automática por teste.

## Teste de carga

```bash
npm run db:seed && npm run build && npm start
npm run loadtest -- --url http://127.0.0.1:3333 --seconds 10 --concurrency 20
```

Mostra requisições por segundo e latência (p50, p95, p99) das rotas mais usadas. O limite geral de 300 requisições por minuto por IP responde 429 acima disso (de propósito); para medir o limite do servidor, rode o teste num ambiente com `NODE_ENV=development`. Ainda não há números publicados: rode no ambiente de destino e registre aqui.
