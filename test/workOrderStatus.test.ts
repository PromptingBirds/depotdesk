import { describe, expect, it } from 'vitest';
import { canTransition, isFinal, nextStatuses } from '../src/domain/workOrderStatus.js';

describe('Lebenszyklus eines Auftrags', () => {
  it.each([
    ['open', 'planned'],
    ['planned', 'in_progress'],
    ['in_progress', 'waiting_parts'],
    ['waiting_parts', 'in_progress'],
    ['in_progress', 'done'],
    ['open', 'cancelled'],
  ] as const)('erlaubt %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ['open', 'done'],
    ['open', 'in_progress'],
    ['done', 'in_progress'],
    ['cancelled', 'open'],
    ['waiting_parts', 'done'],
  ] as const)('verbietet %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('behandelt abgeschlossene und stornierte Aufträge als final', () => {
    expect(isFinal('done')).toBe(true);
    expect(isFinal('cancelled')).toBe(true);
    expect(isFinal('waiting_parts')).toBe(false);
    expect(nextStatuses('done')).toEqual([]);
  });
});
