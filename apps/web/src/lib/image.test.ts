import { describe, expect, it } from 'vitest';
import { fitWithin, needsProcessing } from './image';

describe('fitWithin', () => {
  it('mantém imagens que já cabem', () => {
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('reduz pelo lado maior mantendo a proporção', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });
});

describe('needsProcessing', () => {
  it('converte HEIC e PNG, reduz JPEG grande e deixa PDF e JPEG leve em paz', () => {
    expect(needsProcessing({ type: 'image/heic', size: 900_000 })).toBe(true);
    expect(needsProcessing({ type: 'image/png', size: 200_000 })).toBe(true);
    expect(needsProcessing({ type: 'image/jpeg', size: 4_000_000 })).toBe(true);
    expect(needsProcessing({ type: 'image/jpeg', size: 400_000 })).toBe(false);
    expect(needsProcessing({ type: 'application/pdf', size: 9_000_000 })).toBe(false);
  });
});
