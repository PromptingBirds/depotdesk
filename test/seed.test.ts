import { describe, expect, it } from 'vitest';
import { generateSeedData } from '../src/data/seed.js';
import { REFERENCE_DATE } from './helpers.js';

describe('Demo-Daten', () => {
  const data = generateSeedData({ seed: 42, referenceDate: REFERENCE_DATE });

  it('sind bei gleichem Seed identisch', () => {
    const again = generateSeedData({ seed: 42, referenceDate: REFERENCE_DATE });
    expect(again.workOrders.slice(0, 50)).toEqual(data.workOrders.slice(0, 50));
    expect(again.users).toEqual(data.users);
  });

  it('unterscheiden sich bei anderem Seed', () => {
    const other = generateSeedData({ seed: 7, referenceDate: REFERENCE_DATE });
    expect(other.workOrders.slice(0, 50)).not.toEqual(data.workOrders.slice(0, 50));
  });

  it('haben eindeutige, fortlaufende Auftragsnummern', () => {
    const ids = data.workOrders.map((wo) => wo.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^WO-\d{4}-\d{6}$/.test(id))).toBe(true);
  });

  it('verweisen nur auf Fahrzeuge und Techniker:innen des gleichen Werks', () => {
    const vehicles = new Map(data.vehicles.map((v) => [v.id, v]));
    const users = new Map(data.users.map((u) => [u.id, u]));
    for (const wo of data.workOrders) {
      expect(vehicles.get(wo.vehicleId)?.depot).toBe(wo.depot);
      if (wo.assigneeId) {
        const assignee = users.get(wo.assigneeId);
        expect(assignee?.role).toBe('technician');
        expect(assignee?.depot).toBe(wo.depot);
      }
    }
  });

  it('liegen zeitlich konsistent vor dem Stichtag', () => {
    const reference = REFERENCE_DATE.toISOString();
    for (const wo of data.workOrders) {
      expect(wo.createdAt <= reference).toBe(true);
      expect(wo.completedAt !== null).toBe(wo.status === 'done');
      if (wo.completedAt) expect(wo.completedAt >= wo.createdAt).toBe(true);
    }
  });
});
