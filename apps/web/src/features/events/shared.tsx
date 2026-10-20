import type { EventCard } from '@role/contracts';
import type { EventStatus } from '@role/domain';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../../components/Button';
import { IconShare, Swallow } from '../../components/icons';
import { formatBRL, formatEventDates } from '../../lib/format';

const statusInfo: Record<EventStatus, { label: string; ink: string }> = {
  open: { label: 'Aberta', ink: 'text-sol-ink' },
  confirmed: { label: 'Confirmado', ink: 'text-ok' },
  archived: { label: 'Arquivada', ink: 'text-muted' },
  cancelled: { label: 'Cancelado', ink: 'text-carimbo' },
  closed: { label: 'Conta fechada', ink: 'text-navy' },
};

/** Etiqueta discreta de status para listas e cabeçalhos. */
export function StatusTag({ status, onDark = false }: { status: EventStatus; onDark?: boolean }) {
  const s = statusInfo[status];
  return <span className={`tag ${onDark ? 'text-white' : s.ink}`}>{s.label}</span>;
}

/** Carimbo de tinta. Use `slam` para a batida de entrada (só nos momentos decisivos). */
export function Stamp({
  children,
  tone = 'carimbo',
  slam = false,
  size = 'md',
  delayMs,
}: {
  children: ReactNode;
  tone?: 'carimbo' | 'ok';
  slam?: boolean;
  size?: 'sm' | 'md' | 'lg';
  delayMs?: number;
}) {
  const fontSize = { sm: '1rem', md: '1.5rem', lg: '2rem' }[size];
  const style = {
    fontSize,
    '--stamp-ink': tone === 'ok' ? 'var(--color-ok)' : 'var(--color-carimbo)',
    ...(delayMs !== undefined ? { animationDelay: `${delayMs}ms` } : {}),
  } as CSSProperties;
  return (
    <span className="stamp" style={style} {...(slam ? { 'data-slam': true } : {})}>
      {children}
    </span>
  );
}

/**
 * Medidor da massa crítica: uma vaga por andorinha do quórum. Vagas preenchidas entram voando,
 * escalonadas (respeita prefers-reduced-motion).
 */
export function SwallowMeter({
  confirmed,
  quorum,
  size = 34,
  onDark = false,
}: {
  confirmed: number;
  quorum: number;
  size?: number;
  onDark?: boolean;
}) {
  const extra = Math.max(0, confirmed - quorum);
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={`${confirmed} de ${quorum} confirmações`}
    >
      {Array.from({ length: quorum }, (_, i) => {
        const filled = i < confirmed;
        return (
          <span
            key={i}
            style={{ width: size, height: size, '--i': i } as CSSProperties}
            className={`grid place-items-center rounded-full ${
              filled
                ? `slot-in bg-sol text-on-sol ${onDark ? 'ring-2 ring-white/20' : 'ring-2 ring-night/10'}`
                : onDark
                  ? 'border-2 border-dashed border-white/35'
                  : 'border-2 border-dashed border-line'
            }`}
          >
            {filled && <Swallow size={size * 0.62} />}
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className={`mono ml-1 text-sm font-semibold ${onDark ? 'text-white' : 'text-navy-dark'}`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Bilhete de missão: topo e canhoto separados por picote. */
export function Ticket({
  top,
  bottom,
  night = false,
  className = '',
}: {
  top: ReactNode;
  bottom: ReactNode;
  night?: boolean;
  className?: string;
}) {
  return (
    <div className={`ticket ${night ? 'ticket-night' : ''} ${className}`}>
      <div className="ticket-top">{top}</div>
      <div className="ticket-bottom">{bottom}</div>
    </div>
  );
}

export function inviteUrl(code: string): string {
  // /share/:code entrega as tags Open Graph (prévia no WhatsApp) e redireciona para o convite.
  return `${window.location.origin}/share/${code}`;
}

export function shareText(event: EventCard): string {
  return `Bora? ${event.title} em ${event.destination} (${formatEventDates(event.startDate, event.endDate)}). Custo estimado: ${formatBRL(event.costCapCents)} por pessoa. Responde aí, é rapidinho:`;
}

export function ShareButton({
  event,
  size = 'md',
  variant = 'secondary',
}: {
  event: EventCard;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'soft';
}) {
  async function share() {
    const url = inviteUrl(event.code);
    const text = shareText(event);
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
        return;
      } catch {
        /* usuário cancelou: cai para o WhatsApp */
      }
    }
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
      '_blank',
      'noopener',
    );
  }
  return (
    <Button variant={variant} size={size} onClick={() => void share()}>
      <IconShare size={18} /> Chamar a turma no WhatsApp
    </Button>
  );
}
