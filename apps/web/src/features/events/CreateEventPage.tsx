import type { EventCard } from '@role/contracts';
import { QUORUM_DEFAULT, QUORUM_MAX, QUORUM_MIN } from '@role/domain';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { IconArrowLeft } from '../../components/icons';
import { Field, MoneyInput, Toggle } from '../../components/misc';
import { api } from '../../lib/api';
import { formatBRL, formatEventDates } from '../../lib/format';
import { keys, useAction, useSession } from '../../lib/queries';
import { StatusTag, SwallowMeter, Ticket } from './shared';

const today = () => new Date().toISOString().slice(0, 10);

/** O bilhete que o grupo vai receber, montado enquanto a pessoa digita. */
function LivePreview({
  title,
  destination,
  startDate,
  endDate,
  cost,
  quorum,
  deposit,
}: {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  cost: number | null;
  quorum: number;
  deposit: number | null;
}) {
  const empty = !title.trim();
  return (
    <div aria-label="Prévia do convite" role="group">
      <p className="eyebrow mb-2">Prévia do convite</p>
      <Ticket
        night
        top={
          <div className="px-5 pb-6 pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow !text-white/55">Ordem nº ········</span>
              <StatusTag status="open" onDark />
            </div>
            <p
              className={`font-display mt-3 text-[2.4rem] font-extrabold uppercase leading-[0.95] ${empty ? 'text-white/30' : ''}`}
            >
              {empty ? 'Seu rolê aqui' : title}
            </p>
            <p className="mt-2 font-bold text-sol">{destination.trim() || 'Destino'}</p>
            <p className="text-sm text-white/70">
              {startDate ? formatEventDates(startDate, endDate || null) : 'Data a definir'}
            </p>
          </div>
        }
        bottom={
          <div className="space-y-3 px-5 pb-4 pt-5">
            <SwallowMeter confirmed={1} quorum={quorum} size={32} />
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-muted">Você já conta como a primeira</span>
              <span className="mono whitespace-nowrap text-right text-sm font-semibold">
                {cost !== null ? formatBRL(cost) : 'R$ —'}
                <span className="font-normal text-muted"> /pessoa</span>
              </span>
            </div>
            {deposit !== null && (
              <p className="text-xs font-bold text-carimbo-dark">
                Sinal de {formatBRL(deposit)} no Pix
              </p>
            )}
          </div>
        }
      />
    </div>
  );
}

export function CreateEventPage() {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [quorum, setQuorum] = useState(QUORUM_DEFAULT);
  const [hours, setHours] = useState(48);
  const [needsDeposit, setNeedsDeposit] = useState(false);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [pix, setPix] = useState(session?.profile?.pixKey ?? '');

  const create = useAction((body: object) => api.post<EventCard>('/events', body), {
    invalidate: [keys.feed],
    onSuccess: (card) => navigate(`/c/${card.code}?novo=1`, { replace: true }),
  });

  const valid =
    title.trim().length >= 3 &&
    destination.trim().length >= 2 &&
    !!startDate &&
    cost !== null &&
    (!endDate || endDate >= startDate) &&
    (!needsDeposit || (deposit !== null && pix.trim().length >= 3));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || cost === null) return;
    create.mutate({
      title: title.trim(),
      destination: destination.trim(),
      startDate,
      ...(endDate ? { endDate } : {}),
      costCapCents: cost,
      quorum,
      responseHours: hours,
      requiresDeposit: needsDeposit,
      ...(needsDeposit && deposit !== null ? { depositCents: deposit, pixKey: pix.trim() } : {}),
    });
  }

  return (
    <div className="space-y-5">
      <header className="lg:max-w-xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-bold text-navy-dark">
          <IconArrowLeft size={16} /> Voltar
        </Link>
        <h1 className="mt-2">Lançar um rolê</h1>
        <p className="mt-2 text-muted">
          Cartão fechado, sem enrolação: o grupo só precisa responder <strong>Tô dentro</strong> ou{' '}
          <strong>Passo</strong>.
        </p>
      </header>

      <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:space-y-0">
        <div className="lg:sticky lg:top-8">
          <LivePreview
            title={title}
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            cost={cost}
            quorum={quorum}
            deposit={needsDeposit ? deposit : null}
          />
        </div>

        <form onSubmit={submit} className="card space-y-5 p-5">
          <Field label="Que rolê é esse?">
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Bate e volta Maresias"
              maxLength={80}
              required
            />
          </Field>
          <Field label="Destino">
            <input
              className="field"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Maresias, SP"
              maxLength={120}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                className="field"
                type="date"
                min={today()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Volta (opcional)">
              <input
                className="field"
                type="date"
                min={startDate || today()}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Teto de gasto por pessoa"
            hint="Estimativa honesta: é o que aparece no convite."
          >
            <MoneyInput value={cost} onChange={setCost} placeholder="120,00" />
          </Field>

          <fieldset>
            <legend className="label">Quantas andorinhas para virar oficial?</legend>
            <div className="flex gap-2" role="radiogroup">
              {Array.from({ length: QUORUM_MAX - QUORUM_MIN + 1 }, (_, i) => QUORUM_MIN + i).map(
                (n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={quorum === n}
                    onClick={() => setQuorum(n)}
                    className={`mono size-12 rounded-[10px] border-2 text-lg font-semibold transition-colors ${
                      quorum === n
                        ? 'border-ink bg-ink text-surface'
                        : 'border-line bg-surface text-ink'
                    }`}
                  >
                    {n}
                  </button>
                ),
              )}
            </div>
            <p className="hint">
              Você já conta como a primeira. Com {quorum}, o rolê vira oficial e o resto decide se
              quer ficar de fora.
            </p>
          </fieldset>

          <Field label="Prazo para responder">
            <select
              className="field"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              <option value={24}>24 horas</option>
              <option value={48}>48 horas (padrão)</option>
              <option value={72}>3 dias</option>
              <option value={168}>1 semana</option>
            </select>
          </Field>

          <div className="rounded-[12px] bg-desk-deep p-4">
            <Toggle
              checked={needsDeposit}
              onChange={setNeedsDeposit}
              label="Exigir sinal por Pix"
              hint="Trava anti-pipoca: só garante a vaga quem pagar e enviar o comprovante."
            />
            {needsDeposit && (
              <div className="mt-3 space-y-4">
                <Field label="Valor do sinal">
                  <MoneyInput value={deposit} onChange={setDeposit} placeholder="50,00" />
                </Field>
                <Field
                  label="Chave Pix de quem vai receber"
                  hint="O app não movimenta dinheiro: o Pix é direto entre as pessoas."
                >
                  <input
                    className="field"
                    value={pix}
                    onChange={(e) => setPix(e.target.value)}
                    maxLength={140}
                    placeholder="CPF, e-mail, telefone..."
                  />
                </Field>
                {deposit !== null && cost !== null && deposit > cost && (
                  <p className="text-sm font-bold text-warn">
                    O sinal ({formatBRL(deposit)}) é maior que o teto por pessoa. Confere?
                  </p>
                )}
              </div>
            )}
          </div>

          <Button type="submit" size="lg" block loading={create.isPending} disabled={!valid}>
            Lançar proposta
          </Button>
        </form>
      </div>
    </div>
  );
}
