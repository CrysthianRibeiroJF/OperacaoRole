/**
 * Busca de lugares para o destino, via geocodificação do Open-Meteo (a mesma da previsão do tempo,
 * gratuita e sem chave). Só o texto digitado sai do app; nenhum dado de pessoa.
 */
export interface Place {
  id: string;
  /** "Maresias, São Paulo": é o que vira o destino do rolê. */
  label: string;
  name: string;
  region: string | null;
  latitude: number;
  longitude: number;
}

interface GeoResult {
  id: number;
  name: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}

export const MIN_PLACE_QUERY = 3;

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < MIN_PLACE_QUERY) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=pt&countryCode=BR`,
    signal ? { signal } : {},
  );
  if (!res.ok) throw new Error('Busca de lugares indisponível');
  const results = ((await res.json()) as { results?: GeoResult[] }).results ?? [];

  const seen = new Set<string>();
  const places: Place[] = [];
  for (const r of results) {
    const region = r.admin1 ?? null;
    const label = region ? `${r.name}, ${region}` : r.name;
    if (seen.has(label)) continue;
    seen.add(label);
    places.push({
      id: String(r.id),
      label,
      name: r.name,
      region,
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }
  return places;
}
