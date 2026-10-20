import { describe, expect, it } from 'vitest';
import { describeWeather, forecastWindow } from './weather';

describe('describeWeather', () => {
  it.each([
    [0, 'sun'],
    [2, 'sun'],
    [3, 'cloud'],
    [45, 'fog'],
    [63, 'rain'],
    [81, 'rain'],
    [96, 'storm'],
  ])('código %i vira %s', (code, kind) => {
    expect(describeWeather(code).kind).toBe(kind);
  });
});

describe('forecastWindow', () => {
  const today = new Date('2026-11-01T15:00:00Z');

  it('usa o período do rolê quando está dentro da janela de 16 dias', () => {
    expect(forecastWindow('2026-11-14', '2026-11-15', today)).toEqual({
      from: '2026-11-14',
      to: '2026-11-15',
    });
  });

  it('recorta o fim que passa do limite do provedor', () => {
    expect(forecastWindow('2026-11-14', '2026-11-30', today)).toEqual({
      from: '2026-11-14',
      to: '2026-11-16',
    });
  });

  it('avisa quando ainda é cedo e quando já passou', () => {
    expect(forecastWindow('2026-12-20', null, today)).toEqual({
      status: 'too-far',
      availableOn: '2026-12-05',
    });
    expect(forecastWindow('2026-10-20', '2026-10-25', today)).toEqual({ status: 'past' });
  });

  it('rolê em andamento começa a previsão de hoje', () => {
    expect(forecastWindow('2026-10-30', '2026-11-03', today)).toEqual({
      from: '2026-11-01',
      to: '2026-11-03',
    });
  });
});
