import { useQuery } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MIN_PLACE_QUERY, searchPlaces, type Place } from '../lib/places';
import { IconPin } from './icons';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * Campo de destino com busca de lugares: sugere cidades enquanto a pessoa digita e, ao escolher,
 * entrega o lugar com as coordenadas (para mostrar a previsão do tempo na hora). O texto livre
 * continua valendo: se a busca não achar nada, o que foi digitado vale como destino.
 */
export function PlaceInput({
  value,
  onChange,
  onPick,
  placeholder = 'Maresias, São Paulo',
  required,
  maxLength = 120,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  onPick?: (place: Place | null) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [picked, setPicked] = useState<Place | null>(null);

  const term = useDebounced(value.trim(), 300);
  const search = useQuery({
    queryKey: ['places', term],
    queryFn: ({ signal }) => searchPlaces(term, signal),
    enabled: open && term.length >= MIN_PLACE_QUERY && picked?.label !== term,
    staleTime: 10 * 60_000,
    retry: false,
  });
  const places = search.data ?? [];

  // Fecha a lista ao clicar fora.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function choose(place: Place) {
    setPicked(place);
    onChange(place.label);
    onPick?.(place);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || places.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % places.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? places.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(places[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showList = open && term.length >= MIN_PLACE_QUERY && picked?.label !== term;

  return (
    <div ref={root} className="relative">
      <input
        className="field pr-10"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (picked) {
            setPicked(null);
            onPick?.(null);
          }
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      />
      <span
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${picked ? 'text-ok' : 'text-muted'}`}
        aria-hidden
      >
        <IconPin size={18} />
      </span>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg"
        >
          {search.isFetching && places.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">Buscando lugares…</li>
          )}
          {!search.isFetching && places.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-muted">
              {search.isError
                ? 'A busca não respondeu. Pode digitar o destino normalmente.'
                : 'Nenhum lugar encontrado. O que você digitou vale como destino.'}
            </li>
          )}
          {places.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 ${i === active ? 'bg-navy-soft' : ''}`}
            >
              <IconPin size={16} />
              <span className="min-w-0">
                <span className="block truncate font-bold">{p.name}</span>
                {p.region && <span className="block truncate text-xs text-muted">{p.region}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
