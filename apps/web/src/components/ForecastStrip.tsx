import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { fetchForecast, fetchForecastAt, type WeatherKind } from '../lib/weather';
import { IconCloud, IconFog, IconRain, IconStorm, IconSun } from './icons';

const ICONS: Record<WeatherKind, ReactNode> = {
  sun: <IconSun size={20} />,
  cloud: <IconCloud size={20} />,
  fog: <IconFog size={20} />,
  rain: <IconRain size={20} />,
  storm: <IconStorm size={20} />,
};

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit' });
const fmtDay = (date: string) => weekday.format(new Date(`${date}T12:00:00`)).replace('.', '');
const fmtDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(
    new Date(`${date}T12:00:00`),
  );

const MAX_DAYS = 5;

/**
 * Previsão em uma linha para um destino e período: serve de apoio na hora de escolher o lugar e a
 * data (criar rolê, enquete). Com coordenadas (lugar escolhido na busca) é exata; sem elas, usa o nome.
 * Se o provedor falhar, some em silêncio: a previsão nunca atrapalha o fluxo.
 */
export function ForecastStrip({
  destination,
  startDate,
  endDate,
  coords,
}: {
  destination: string;
  startDate: string | null | undefined;
  endDate?: string | null | undefined;
  coords?: { latitude: number; longitude: number } | null | undefined;
}) {
  const place = destination.trim();
  const enabled = place.length >= 3 && !!startDate;
  const { data, isPending, fetchStatus } = useQuery({
    queryKey: ['forecast-strip', coords?.latitude, coords?.longitude, place, startDate, endDate],
    queryFn: ({ signal }) =>
      coords
        ? fetchForecastAt(coords.latitude, coords.longitude, startDate!, endDate ?? null, signal)
        : fetchForecast(place, startDate!, endDate ?? null, signal),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  });

  if (!enabled) return null;
  if (isPending && fetchStatus !== 'idle') {
    return (
      <div
        className="h-12 animate-pulse rounded-[10px] bg-desk-deep"
        aria-label="Buscando previsão"
      />
    );
  }
  if (!data || data.status === 'unavailable' || data.status === 'past') return null;

  if (data.status === 'too-far') {
    return (
      <p className="rounded-[10px] bg-desk-deep px-3 py-2 text-xs text-muted">
        A previsão do tempo aparece a partir de {fmtDate(data.availableOn)} (até 16 dias antes).
      </p>
    );
  }

  const shown = data.days.slice(0, MAX_DAYS);
  return (
    <div aria-label={`Previsão do tempo em ${place}`} role="group">
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((d) => {
          const wet = d.rainPct >= 50;
          return (
            <li
              key={d.date}
              title={`${d.label} · vento ${d.windKmh} km/h`}
              className="flex shrink-0 items-center gap-2 rounded-[10px] bg-desk-deep px-2.5 py-2"
            >
              <span className={wet ? 'text-navy' : 'text-sol-ink'}>{ICONS[d.kind]}</span>
              <span className="leading-tight">
                <span className="block whitespace-nowrap text-xs font-bold capitalize">
                  {fmtDay(d.date)}
                </span>
                <span className="mono block whitespace-nowrap text-xs">
                  {d.maxC}°<span className="text-muted"> / {d.minC}°</span>
                </span>
                <span
                  className={`mono block text-[11px] ${wet ? 'font-semibold text-navy' : 'text-muted'}`}
                >
                  chuva {d.rainPct}%
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {data.days.length > MAX_DAYS && (
        <p className="mt-1 text-xs text-muted">
          +{data.days.length - MAX_DAYS} dias na aba Base do rolê.
        </p>
      )}
    </div>
  );
}
