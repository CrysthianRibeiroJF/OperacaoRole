import type { FastifyInstance } from 'fastify';
import { formatBRL, fmtDateTime } from '../../lib/format';
import { confirmedUserIds, findEventByCode } from './event.queries';

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * Página de compartilhamento: carrega as tags Open Graph (o WhatsApp lê só o HTML, sem rodar o app)
 * e manda quem é humano para o convite. Dados públicos do convite apenas: nada de valores internos.
 */
export async function shareRoutes(app: FastifyInstance) {
  const { ctx } = app;

  app.get<{ Params: { code: string } }>('/share/:code', async (req, reply) => {
    const code = req.params.code
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16);
    const event = await findEventByCode(ctx.db, code);
    const web = ctx.config.PUBLIC_WEB_URL.replace(/\/$/, '');

    if (!event) {
      return reply
        .code(404)
        .type('text/html; charset=utf-8')
        .send('<!doctype html><title>Convite não encontrado</title><p>Convite não encontrado.</p>');
    }

    const confirmed = (await confirmedUserIds(ctx.db, event.id)).length;
    const missing = Math.max(0, event.quorum - confirmed);
    const cost = formatBRL(event.cost_cap_cents);
    const description =
      event.status === 'open'
        ? `${missing > 0 ? (missing === 1 ? 'Falta 1 andorinha' : `Faltam ${missing} andorinhas`) : 'Quórum atingido'} para virar oficial · ${cost} por pessoa · responda até ${fmtDateTime(event.response_deadline_at)}`
        : event.status === 'confirmed'
          ? `Rolê confirmado com ${confirmed} pessoas · ${cost} por pessoa. Ainda dá tempo de entrar.`
          : `Convite de ${event.destination}`;

    const title = escapeHtml(`${event.title} · ${event.destination}`);
    const desc = escapeHtml(description);
    const target = `/c/${event.code}`;
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${desc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Operação Rolê">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${escapeHtml(`${web}/share/${event.code}`)}">
<meta property="og:image" content="${escapeHtml(`${web}/og.png`)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${target}">
</head>
<body><p>Abrindo o convite… <a href="${target}">Toque aqui se não abrir.</a></p>
</body>
</html>`;

    return reply
      .header('cache-control', 'public, max-age=60')
      .type('text/html; charset=utf-8')
      .send(html);
  });
}
