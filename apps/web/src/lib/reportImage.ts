import type { MissionReportDto } from '@role/contracts';
import { formatBRL, formatEventDates } from './format';

const W = 1080;
const H = 1350;

/** Quebra o texto em linhas que cabem na largura (sem biblioteca: o cartão é simples). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Texto do compartilhamento (também serve de legenda quando o navegador não aceita arquivo). */
export function reportText(report: MissionReportDto, categoryLabel: (c: string) => string): string {
  const parts = [
    `Missão cumprida: ${report.event.title} em ${report.event.destination}.`,
    `${report.headcount} pessoas, ${report.days} ${report.days === 1 ? 'dia' : 'dias'}, ${formatBRL(report.perHeadCents)} por cabeça.`,
  ];
  if (report.topCategory) {
    parts.push(`Onde mais gastamos: ${categoryLabel(report.topCategory.category)}.`);
  }
  parts.push('Organizado no Operação Rolê.');
  return parts.join(' ');
}

/** Desenha o cartão do Relatório de Missão em PNG, pronto para virar story ou ir para o grupo. */
export async function renderReportImage(
  report: MissionReportDto,
  categoryLabel: (c: string) => string,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  ctx.fillStyle = '#0e1f3d';
  ctx.fillRect(0, 0, W, H);
  // Picote do bilhete.
  ctx.fillStyle = '#16294d';
  ctx.fillRect(60, 60, W - 120, H - 120);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.setLineDash([14, 12]);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(60, 860);
  ctx.lineTo(W - 60, 860);
  ctx.stroke();
  ctx.setLineDash([]);

  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 34px ${font}`;
  ctx.fillText('RELATÓRIO DE MISSÃO', 110, 150);

  ctx.fillStyle = '#ffffff';
  ctx.font = `800 92px ${font}`;
  const title = wrap(ctx, report.event.title.toUpperCase(), W - 220).slice(0, 3);
  title.forEach((l, i) => ctx.fillText(l, 110, 270 + i * 100));

  const afterTitle = 270 + (title.length - 1) * 100 + 70;
  ctx.fillStyle = '#ffc72c';
  ctx.font = `700 42px ${font}`;
  ctx.fillText(report.event.destination, 110, afterTitle);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `500 36px ${font}`;
  ctx.fillText(
    formatEventDates(report.event.startDate, report.event.endDate),
    110,
    afterTitle + 56,
  );

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `600 32px ${font}`;
  ctx.fillText('CUSTOU POR CABEÇA', 110, 690);
  ctx.fillStyle = '#ffc72c';
  ctx.font = `800 150px ${font}`;
  ctx.fillText(formatBRL(report.perHeadCents), 110, 820);

  const rows: [string, string][] = [
    ['Pessoas', String(report.headcount)],
    ['Dias', String(report.days)],
    ['Total do grupo', formatBRL(report.totalCents)],
  ];
  if (report.topCategory)
    rows.push(['Onde mais gastamos', categoryLabel(report.topCategory.category)]);
  if (report.topPayer)
    rows.push(['Quem mais adiantou', report.topPayer.user.name.split(' ')[0] ?? '']);
  rows.slice(0, 5).forEach(([label, value], i) => {
    const y = 940 + i * 74;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `500 36px ${font}`;
    ctx.fillText(label, 110, y);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 40px ${font}`;
    const width = ctx.measureText(value).width;
    ctx.fillText(value, W - 110 - width, y);
  });

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `600 30px ${font}`;
  ctx.fillText('Operação Rolê', 110, H - 90);
  if (!report.final) {
    ctx.fillStyle = '#e0402a';
    ctx.font = `800 30px ${font}`;
    const t = 'PARCIAL: CONTA AINDA ABERTA';
    ctx.fillText(t, W - 110 - ctx.measureText(t).width, H - 90);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))),
      'image/png',
    ),
  );
}
