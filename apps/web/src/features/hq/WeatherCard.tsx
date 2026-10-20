import { useQuery } from '@tanstack/react-query';
import type { EventCard } from '@role/contracts';
import type { ReactNode } from 'react';
import { IconCloud, IconFog, IconRain, IconStorm, IconSun } from '../../components/icons';
import { fetchForecast, type DayForecast, type WeatherKind } from '../../lib/weather';

const ICONS: Record<WeatherKind, ReactNode> = {
  sun: <IconSun size={26} />,
  cloud: <IconCloud size={26} />,
  fog: <IconFog size={26} />,
  rain: <IconRain size={26} />,
  storm: <IconStorm size={26} />,
};

const weekday = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const fmtDay = (date: string) => weekday.format(new Date(`${date}T12:00:00`)).replace('.', '');

/** Previsão dos dias do rolê. Se o provedor falhar, o cartão some em vez de atrapalhar o app. */
export function WeatherCard({ event }: { event: EventCard }) {
  const { data, isPending } = useQuery({
    queryKey: ['weather', event.destination, event.startDate, event.endDate],
    queryFn: ({ signal }) =>
      fetchForecast(event.destination, event.startDate, event.endDate, signal),
    staleTime: 30 * 60_000,
    retry: false,
  });

  if (event.status === 'archived' || event.status === 'cancelled' || event.status === 'closed')
    return null;
  if (isPending) {
    return (
      <section className="card space-y-3 p-5" aria-label="Carregando previsão do tempo">
        <div className="h-4 w-1/3 animate-pulse rounded bg-desk-deep" />
        <div className="h-16 animate-pulse rounded-[10px] bg-desk-deep" />
      </section>
    );
  }
  if (!data || data.status === 'unavailable' || data.status === 'past') return null;

  if (data.status === 'too-far') {
    const when = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(
      new Date(`${data.availableOn}T12:00:00`),
    );
    return (
      <section className="card p-5">
        <h2>Previsão do tempo</h2>
        <p className="mt-2 text-sm text-muted">
          A previsão para {event.destination} aparece a partir de {when}, 16 dias antes do rolê.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h2>Previsão do tempo</h2>
      <p className="mt-1 text-sm text-muted">{event.destination}</p>
      <ul className="mt-3 grid gap-2">
        {data.days.map((d) => (
          <Day key={d.date} day={d} />
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Dados: Open-Meteo.</p>
    </section>
  );
}

function Day({ day }: { day: DayForecast }) {
  const wet = day.rainPct >= 50;
  return (
    <li className="flex items-center gap-3 rounded-[10px] bg-desk-deep px-3 py-2.5">
      <span className={wet ? 'text-navy' : 'text-sol-ink'}>{ICONS[day.kind]}</span>
      <div className="min-w-0 flex-1 shrink-0">
        <p className="whitespace-nowrap text-sm font-bold capitalize">{fmtDay(day.date)}</p>
        <p className="text-xs text-muted">{day.label}</p>
      </div>
      <div className="text-right">
        <p className="mono text-sm font-semibold">
          {day.maxC}° <span className="font-normal text-muted">/ {day.minC}°</span>
        </p>
        <p className={`mono text-xs ${wet ? 'font-semibold text-navy' : 'text-muted'}`}>
          chuva {day.rainPct}% · vento {day.windKmh} km/h
        </p>
      </div>
    </li>
  );
}
