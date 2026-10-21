import type { PollDto } from '@role/contracts';
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ForecastStrip } from '../../components/ForecastStrip';
import { IconArrowLeft, IconPlus, IconTrash } from '../../components/icons';
import { Field } from '../../components/misc';
import { PlaceInput } from '../../components/PlaceInput';
import { api } from '../../lib/api';
import type { Place } from '../../lib/places';
import { keys, useAction } from '../../lib/queries';

interface Draft {
  key: number;
  label: string;
  destination: string;
  place: Place | null;
  startDate: string;
  endDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);
let nextKey = 0;
const blank = (): Draft => ({
  key: nextKey++,
  label: '',
  destination: '',
  place: null,
  startDate: '',
  endDate: '',
});

/** O nome da opção é opcional: sem ele, vale o lugar escolhido (ou o que foi digitado). */
const effectiveLabel = (d: Draft) => d.label.trim() || d.place?.name || d.destination.trim();

/** Enquete antes da proposta: o grupo vota em datas e lugares e o vencedor vira o rolê. */
export function CreatePollPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<Draft[]>(() => [blank(), blank()]);

  const create = useAction((body: object) => api.post<PollDto>('/polls', body), {
    invalidate: [keys.polls],
    onSuccess: (poll) => navigate(`/enquete/${poll.code}`, { replace: true }),
  });

  const patch = (key: number, change: Partial<Draft>) =>
    setOptions((list) => list.map((o) => (o.key === key ? { ...o, ...change } : o)));

  const valid =
    title.trim().length >= 3 &&
    options.length >= POLL_MIN_OPTIONS &&
    options.every(
      (o) =>
        effectiveLabel(o).length >= 2 &&
        (!o.endDate || (!!o.startDate && o.endDate >= o.startDate)),
    );

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    create.mutate({
      title: title.trim(),
      options: options.map((o) => ({
        label: effectiveLabel(o),
        ...(o.destination.trim().length >= 2 ? { destination: o.destination.trim() } : {}),
        ...(o.startDate ? { startDate: o.startDate } : {}),
        ...(o.endDate ? { endDate: o.endDate } : {}),
      })),
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <header>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark">
          <IconArrowLeft size={16} /> Voltar
        </Link>
        <h1 className="mt-2">Enquete do rolê</h1>
        <p className="mt-2 text-muted">
          Ainda não sabem onde nem quando? Coloque as opções, mande o link no grupo e deixe a turma
          votar. A que vencer vira a proposta.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <div className="card p-5">
          <Field label="Qual é a pergunta?">
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Onde e quando é o rolê de novembro?"
              maxLength={80}
              required
              autoFocus
            />
          </Field>
        </div>

        {options.map((o, index) => (
          <fieldset key={o.key} className="card space-y-4 p-5">
            <legend className="eyebrow !text-ink px-1">Opção {index + 1}</legend>
            <Field label="Lugar" hint="Busque a cidade: a previsão do tempo aparece logo abaixo.">
              <PlaceInput
                value={o.destination}
                onChange={(destination) => patch(o.key, { destination })}
                onPick={(place) => patch(o.key, { place })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data">
                <input
                  className="field"
                  type="date"
                  min={today()}
                  value={o.startDate}
                  onChange={(e) => patch(o.key, { startDate: e.target.value })}
                />
              </Field>
              <Field label="Volta (opcional)">
                <input
                  className="field"
                  type="date"
                  min={o.startDate || today()}
                  value={o.endDate}
                  onChange={(e) => patch(o.key, { endDate: e.target.value })}
                />
              </Field>
            </div>
            <ForecastStrip
              destination={o.destination}
              startDate={o.startDate}
              endDate={o.endDate || null}
              coords={o.place}
            />
            <Field label="Nome da opção (opcional)" hint="Sem nome, vale o lugar escolhido.">
              <input
                className="field"
                value={o.label}
                onChange={(e) => patch(o.key, { label: e.target.value })}
                placeholder={o.place?.name ?? 'Praia no fim de semana'}
                maxLength={60}
              />
            </Field>
            {options.length > POLL_MIN_OPTIONS && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOptions((list) => list.filter((x) => x.key !== o.key))}
              >
                <IconTrash size={16} /> Remover opção
              </Button>
            )}
          </fieldset>
        ))}

        {options.length < POLL_MAX_OPTIONS && (
          <Button variant="soft" block onClick={() => setOptions((list) => [...list, blank()])}>
            <IconPlus size={16} /> Adicionar opção
          </Button>
        )}

        <Button type="submit" size="lg" block loading={create.isPending} disabled={!valid}>
          Criar enquete
        </Button>
      </form>
    </div>
  );
}
