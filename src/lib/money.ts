import type { PartUsage } from '../domain/types.js';

export function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function partsTotalEur(parts: readonly PartUsage[]): number {
  return roundCents(parts.reduce((sum, part) => sum + part.quantity * part.unitPriceEur, 0));
}
