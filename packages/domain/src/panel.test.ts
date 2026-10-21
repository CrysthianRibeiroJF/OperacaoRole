import { describe, expect, it } from 'vitest';
import { can, type Actor } from './permissions';
import {
  myProgress,
  overallReadiness,
  percentOf,
  rideModeOf,
  sortStops,
  summarizeFleet,
  summarizeSupplies,
  type RideMode,
  type SupplyLine,
} from './panel';

const line = (over: Partial<SupplyLine> = {}): SupplyLine => ({
  category: 'meat',
  estPriceCents: 1000,
  realPriceCents: null,
  done: false,
  assigneeId: null,
  ...over,
});

describe('percentOf', () => {
  it('arredonda, limita em 0 a 100 e não trata "nada a medir" como pronto', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(percentOf(5, 3)).toBe(100);
    expect(percentOf(-1, 3)).toBe(0);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(3, 0)).toBe(0);
  });
});

describe('resumo do Mercado', () => {
  it('agrupa por categoria, na ordem do app, só com as que têm item', () => {
    const s = summarizeSupplies(
      [line({ category: 'drinks' }), line({ category: 'meat' }), line({ category: 'meat' })],
      4,
    );
    expect(s.byCategory.map((c) => [c.category, c.total])).toEqual([
      ['meat', 2],
      ['drinks', 1],
    ]);
  });

  it('soma estimado e real, mede o desvio só onde há os dois preços e divide por cabeça', () => {
    const s = summarizeSupplies(
      [
        line({ estPriceCents: 10_000, realPriceCents: 12_500, done: true, assigneeId: 'a' }),
        line({ estPriceCents: 4_000, realPriceCents: 3_000, done: true, assigneeId: 'b' }),
        line({ estPriceCents: 6_001, assigneeId: 'a' }),
        // Comprado sem estimativa: entra no real, mas não no desvio.
        line({ estPriceCents: null, realPriceCents: 999, done: true, assigneeId: 'b' }),
      ],
      3,
    );
    expect(s.estCents).toBe(20_001);
    expect(s.realCents).toBe(16_499);
    expect(s.deviationCents).toBe(1_500);
    expect(s.perHeadEstCents).toBe(6_667);
    expect(s.percentDone).toBe(75);
  });

  it('conta como sem responsável só o que ainda não foi comprado nem assumido', () => {
    const s = summarizeSupplies(
      [
        line(),
        line(),
        line({ assigneeId: 'a' }),
        line({ done: true }), // já comprado: não é pendência
      ],
      2,
    );
    expect(s.unassignedItems).toBe(2);
    expect(s.byCategory[0]!.unassigned).toBe(2);
  });

  it('mostra quanto cada um assumiu, do maior para o menor', () => {
    const s = summarizeSupplies(
      [
        line({ assigneeId: 'b' }),
        line({ assigneeId: 'a', done: true }),
        line({ assigneeId: 'a' }),
        line({ assigneeId: 'a' }),
      ],
      2,
    );
    expect(s.load).toEqual([
      { userId: 'a', items: 3, done: 1 },
      { userId: 'b', items: 1, done: 0 },
    ]);
  });

  it('lista vazia e turma zerada não quebram', () => {
    const s = summarizeSupplies([], 0);
    expect(s).toMatchObject({ totalItems: 0, percentDone: 0, perHeadEstCents: null, load: [] });
  });
});

describe('transporte', () => {
  it('o lugar no carro vale mais que um plano antigo', () => {
    expect(rideModeOf({ drives: true, hasSeat: false, plan: 'app' })).toBe('driver');
    expect(rideModeOf({ drives: false, hasSeat: true, plan: 'app' })).toBe('passenger');
    expect(rideModeOf({ drives: false, hasSeat: false, plan: 'app' })).toBe('app');
    expect(rideModeOf({ drives: false, hasSeat: false, plan: null })).toBe('none');
  });

  it('conta cobertura, lugares livres e quem ainda não tem como ir', () => {
    const modes: RideMode[] = [
      'driver',
      'driver',
      'passenger',
      'passenger',
      'app',
      'own',
      'none',
      'none',
    ];
    const s = summarizeFleet({ modes, seatsTotal: 5 });
    expect(s).toMatchObject({
      headcount: 8,
      drivers: 2,
      passengers: 2,
      appRiders: 1,
      ownRiders: 1,
      undecided: 2,
      seatsFree: 3,
      seatShortfall: 0,
      percentCovered: 75,
    });
  });

  it('alerta quando faltam lugares para quem ainda não se resolveu', () => {
    const modes: RideMode[] = ['driver', 'passenger', 'none', 'none', 'none'];
    const s = summarizeFleet({ modes, seatsTotal: 2 });
    expect(s.seatsFree).toBe(1);
    expect(s.seatShortfall).toBe(2);
  });

  it('sem ninguém, nada a cobrir', () => {
    expect(summarizeFleet({ modes: [], seatsTotal: 0 })).toMatchObject({
      headcount: 0,
      percentCovered: 0,
      seatShortfall: 0,
    });
  });
});

describe('linha do tempo dos pontos', () => {
  it('ordena por horário; sem horário vai para o fim, na ordem de criação', () => {
    const stops = [
      { id: 'c', time: null, position: 0 },
      { id: 'b', time: '09:30', position: 1 },
      { id: 'a', time: '07:15', position: 2 },
      { id: 'd', time: null, position: 3 },
      { id: 'e', time: '09:30', position: 0 },
    ];
    expect(sortStops(stops).map((s) => s.id)).toEqual(['a', 'e', 'b', 'c', 'd']);
  });
});

describe('prontidão e andamento pessoal', () => {
  it('tira a média das áreas', () => {
    expect(overallReadiness([{ percent: 100 }, { percent: 50 }, { percent: 0 }])).toBe(50);
    expect(overallReadiness([])).toBe(0);
  });

  it('mostra o que falta, na ordem dos passos', () => {
    const p = myProgress([
      { key: 'a', label: 'A', done: true, tab: 'cofre' },
      { key: 'b', label: 'B', done: false, tab: 'frotas' },
      { key: 'c', label: 'C', done: false, tab: 'base' },
    ]);
    expect(p.percent).toBe(33);
    expect(p.pending.map((s) => s.key)).toEqual(['b', 'c']);
    expect(myProgress([])).toEqual({ percent: 0, pending: [] });
  });
});

describe('permissão dos painéis', () => {
  const actor = (over: Partial<Actor>): Actor => ({
    isOrganizer: false,
    roles: [],
    participation: 'in',
    vacantRoles: [],
    ...over,
  });

  it('o Idealizador vê todos os painéis, mesmo com os cargos preenchidos', () => {
    const org = actor({ isOrganizer: true });
    for (const a of [
      'panel.overview',
      'panel.supplies',
      'panel.fleet',
      'panel.base',
      'panel.treasury',
    ] as const) {
      expect(can(org, a)).toBe(true);
    }
  });

  it('cada General vê só o painel do próprio cargo, e a visão geral é só do Idealizador', () => {
    const g = actor({ roles: ['supplies'] });
    expect(can(g, 'panel.supplies')).toBe(true);
    expect(can(g, 'panel.fleet')).toBe(false);
    expect(can(g, 'panel.base')).toBe(false);
    expect(can(g, 'panel.treasury')).toBe(false);
    expect(can(g, 'panel.overview')).toBe(false);
  });

  it('quem não tem cargo não vê painel de General', () => {
    const none = actor({});
    expect(can(none, 'panel.supplies')).toBe(false);
    expect(can(none, 'panel.treasury')).toBe(false);
  });
});
