/**
 * Previsão do tempo para os dias do rolê, via Open-Meteo (gratuita, sem chave, chamada do navegador).
 * Só o nome do destino sai do app para a geocodificação; nenhum dado de pessoa.
 */
export type WeatherKind = 'sun' | 'cloud' | 'fog' | 'rain' | 'storm';

export interface DayForecast {
  date: string;
  kind: WeatherKind;
  label: string;
  maxC: number;
  minC: number;
  rainPct: number;
  windKmh: number;
}

export type Forecast =
  | { status: 'ok'; days: DayForecast[] }
  | { status: 'too-far'; availableOn: string }
  | { status: 'past' }
  | { status: 'unavailable' };

/** Códigos WMO do Open-Meteo → texto em português e ícone. */
export function describeWeather(code: number): { kind: WeatherKind; label: string } {
  if (code === 0) return { kind: 'sun', label: 'Céu limpo' };
  if (code <= 2) return { kind: 'sun', label: 'Sol com nuvens' };
  if (code === 3) return { kind: 'cloud', label: 'Nublado' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'Neblina' };
  if (code >= 51 && code <= 57) return { kind: 'rain', label: 'Garoa' };
  if (code >= 61 && code <= 67) return { kind: 'rain', label: 'Chuva' };
  if (code >= 80 && code <= 82) return { kind: 'rain', label: 'Pancadas de chuva' };
  if (code >= 95) return { kind: 'storm', label: 'Tempestade' };
  return { kind: 'cloud', label: 'Nublado' };
}

const MAX_FORECAST_DAYS = 16;
const DAY_MS = 86_400_000;

const toDay = (d: Date) => d.toISOString().slice(0, 10);

/** Recorta o período do rolê à janela que o provedor cobre (hoje até +16 dias). */
export function forecastWindow(
  start: string,
  end: string | null,
  today: Date,
): { from: string; to: string } | { status: 'too-far'; availableOn: string } | { status: 'past' } {
  const last = end ?? start;
  const todayStr = toDay(today);
  if (last < todayStr) return { status: 'past' };
  const limit = toDay(new Date(today.getTime() + (MAX_FORECAST_DAYS - 1) * DAY_MS));
  if (start > limit) {
    const availableOn = toDay(
      new Date(new Date(`${start}T12:00:00Z`).getTime() - (MAX_FORECAST_DAYS - 1) * DAY_MS),
    );
    return { status: 'too-far', availableOn };
  }
  return { from: start < todayStr ? todayStr : start, to: last > limit ? limit : last };
}

type Daily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_probability_max?: number[];
  wind_speed_10m_max?: number[];
};

/** Previsão por coordenadas (já sabemos o lugar: veio da busca de lugares). */
export async function fetchForecastAt(
  latitude: number,
  longitude: number,
  start: string,
  end: string | null,
  signal?: AbortSignal,
): Promise<Forecast> {
  const window = forecastWindow(start, end, new Date());
  if ('status' in window) return window;
  const init: RequestInit = signal ? { signal } : {};

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=America%2FSao_Paulo&start_date=${window.from}&end_date=${window.to}`;
    const res = await fetch(url, init);
    if (!res.ok) return { status: 'unavailable' };
    const d = ((await res.json()) as { daily?: Daily }).daily;
    if (!d?.time) return { status: 'unavailable' };

    return {
      status: 'ok',
      days: d.time.map((date, i) => {
        const { kind, label } = describeWeather(Number(d.weather_code?.[i] ?? 3));
        return {
          date,
          kind,
          label,
          maxC: Math.round(Number(d.temperature_2m_max?.[i])),
          minC: Math.round(Number(d.temperature_2m_min?.[i])),
          rainPct: Math.round(Number(d.precipitation_probability_max?.[i] ?? 0)),
          windKmh: Math.round(Number(d.wind_speed_10m_max?.[i] ?? 0)),
        };
      }),
    };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Previsão a partir do nome do destino ("Maresias, SP"): geocodifica a cidade e consulta o provedor. */
export async function fetchForecast(
  destination: string,
  start: string,
  end: string | null,
  signal?: AbortSignal,
): Promise<Forecast> {
  const window = forecastWindow(start, end, new Date());
  if ('status' in window) return window;
  const init: RequestInit = signal ? { signal } : {};

  try {
    const city = destination.split(',')[0]!.trim();
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=pt&countryCode=BR`,
      init,
    );
    if (!geo.ok) return { status: 'unavailable' };
    const place = ((await geo.json()) as { results?: { latitude: number; longitude: number }[] })
      .results?.[0];
    if (!place) return { status: 'unavailable' };
    return fetchForecastAt(place.latitude, place.longitude, start, end, signal);
  } catch {
    return { status: 'unavailable' };
  }
}
