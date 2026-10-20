import type { BaseInfo, EventDetail } from '@role/contracts';
import { useState, type FormEvent } from 'react';
import {
  IconClock,
  IconEdit,
  IconKey,
  IconPin,
  IconReceipt,
  IconWifi,
} from '../../components/icons';
import { Button } from '../../components/Button';
import { CopyButton, Field } from '../../components/misc';
import { Sheet } from '../../components/Sheet';
import { api } from '../../lib/api';
import { eventKeys, useAction } from '../../lib/queries';
import { ShareButton } from '../events/shared';

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-soft text-navy-dark">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase text-muted">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export function BaseTab({ detail }: { detail: EventDetail }) {
  const { event, base, me, roles } = detail;
  const [editing, setEditing] = useState(false);
  const canEdit = me.can['base.edit'] && (event.status === 'open' || event.status === 'confirmed');
  const baseHolder = roles.find((r) => r.role === 'base')?.user;
  const empty = Object.values(base).every((v) => !v);

  const query = encodeURIComponent(base.address ?? '');

  return (
    <>
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2>Mural da Base</h2>
          {canEdit && (
            <Button size="sm" variant="soft" onClick={() => setEditing(true)}>
              <IconEdit size={15} /> Editar
            </Button>
          )}
        </div>

        {empty ? (
          <p className="mt-3 text-muted">
            {baseHolder
              ? `${baseHolder.name} (General da Base) ainda vai preencher endereço, Wi-Fi e regras da casa.`
              : 'Ninguém assumiu a Base ainda. Quando alguém assumir, endereço, Wi-Fi e regras da casa ficam aqui.'}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-line">
            {base.address && (
              <Row icon={<IconPin size={20} />} label="Endereço">
                <p className="font-bold">{base.address}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    className="inline-flex min-h-9 items-center rounded-xl bg-navy-soft px-3 text-sm font-bold text-navy-dark"
                    href={`https://waze.com/ul?q=${query}&navigate=yes`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir no Waze
                  </a>
                  <a
                    className="inline-flex min-h-9 items-center rounded-xl bg-navy-soft px-3 text-sm font-bold text-navy-dark"
                    href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Google Maps
                  </a>
                </div>
              </Row>
            )}
            {(base.wifiName || base.wifiPassword) && (
              <Row icon={<IconWifi size={20} />} label="Wi-Fi">
                {base.wifiName && <p className="font-bold">{base.wifiName}</p>}
                {base.wifiPassword && (
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded-lg bg-desk px-2 py-1 font-bold">
                      {base.wifiPassword}
                    </code>
                    <CopyButton value={base.wifiPassword} label="Senha" />
                  </div>
                )}
              </Row>
            )}
            {base.gateCode && (
              <Row icon={<IconKey size={20} />} label="Portão / cadeado">
                <div className="flex items-center gap-2">
                  <code className="rounded-lg bg-desk px-2 py-1 font-bold">{base.gateCode}</code>
                  <CopyButton value={base.gateCode} label="Código" />
                </div>
              </Row>
            )}
            {base.checkoutTime && (
              <Row icon={<IconClock size={20} />} label="Check-out">
                <p className="font-bold">{base.checkoutTime}</p>
              </Row>
            )}
            {base.houseRules && (
              <Row icon={<IconReceipt size={20} />} label="Regras da casa">
                <p className="whitespace-pre-line">{base.houseRules}</p>
              </Row>
            )}
          </div>
        )}
      </section>

      {base.schedule && (
        <section className="card p-5">
          <h2>Roteiro</h2>
          <p className="mt-2 whitespace-pre-line">{base.schedule}</p>
        </section>
      )}

      {(event.status === 'open' || event.status === 'confirmed') && (
        <section className="card space-y-3 p-5">
          <h2>Mais gente, rolê mais barato</h2>
          <p className="text-muted">
            Quanto mais confirmados, menor a parte de cada um nos custos fixos.
          </p>
          <ShareButton event={event} />
        </section>
      )}

      <BaseSheet
        open={editing}
        onClose={() => setEditing(false)}
        eventId={event.id}
        code={event.code}
        initial={base}
      />
    </>
  );
}

function BaseSheet({
  open,
  onClose,
  eventId,
  code,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  code: string;
  initial: BaseInfo;
}) {
  const [form, setForm] = useState<BaseInfo>(initial);
  const set = (key: keyof BaseInfo) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value || null }));

  const save = useAction((body: BaseInfo) => api.put(`/events/${eventId}/base`, body), {
    invalidate: eventKeys(eventId, code),
    success: 'Mural atualizado',
    onSuccess: onClose,
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form);
  }

  return (
    <Sheet open={open} title="Editar o Mural da Base" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Endereço">
          <input
            className="field"
            value={form.address ?? ''}
            onChange={(e) => set('address')(e.target.value)}
            maxLength={240}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome do Wi-Fi">
            <input
              className="field"
              value={form.wifiName ?? ''}
              onChange={(e) => set('wifiName')(e.target.value)}
              maxLength={60}
            />
          </Field>
          <Field label="Senha do Wi-Fi">
            <input
              className="field"
              value={form.wifiPassword ?? ''}
              onChange={(e) => set('wifiPassword')(e.target.value)}
              maxLength={80}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Código do portão">
            <input
              className="field"
              value={form.gateCode ?? ''}
              onChange={(e) => set('gateCode')(e.target.value)}
              maxLength={40}
            />
          </Field>
          <Field label="Check-out">
            <input
              className="field"
              value={form.checkoutTime ?? ''}
              onChange={(e) => set('checkoutTime')(e.target.value)}
              placeholder="11h"
              maxLength={20}
            />
          </Field>
        </div>
        <Field label="Regras da casa">
          <textarea
            className="field min-h-20"
            value={form.houseRules ?? ''}
            onChange={(e) => set('houseRules')(e.target.value)}
            maxLength={1000}
          />
        </Field>
        <Field label="Roteiro">
          <textarea
            className="field min-h-24"
            value={form.schedule ?? ''}
            onChange={(e) => set('schedule')(e.target.value)}
            maxLength={2000}
            placeholder={'Sábado 8h: saída\n10h: praia'}
          />
        </Field>
        <Button type="submit" block loading={save.isPending}>
          Salvar
        </Button>
      </form>
    </Sheet>
  );
}
