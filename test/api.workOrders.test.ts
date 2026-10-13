import { describe, expect, it } from 'vitest';
import { setup, TODAY } from './helpers.js';

type Summary = { id: string; depot: string; status: string; dueDate: string; overdue: boolean; vehicle: { fleetNumber: string } };

describe('GET /api/work-orders', () => {
  const { as } = setup();

  it('liefert die erste Seite sortiert nach Fälligkeit', async () => {
    const res = await as('admin').get('/api/work-orders');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 50 });
    expect(res.body.items).toHaveLength(50);
    expect(res.body.total).toBeGreaterThan(10_000);
    const dueDates = res.body.items.map((wo: Summary) => wo.dueDate);
    expect(dueDates).toEqual([...dueDates].sort());
  });

  it('zeigt der Disposition nur Aufträge des eigenen Werks', async () => {
    const res = await as('j.berger').get('/api/work-orders?pageSize=100');
    expect(res.body.items.every((wo: Summary) => wo.depot === 'NUE')).toBe(true);

    const foreign = await as('j.berger').get('/api/work-orders?depot=MUC');
    expect(foreign.body.total).toBe(0);
  });

  it('zeigt dem Controlling alle Werke', async () => {
    const res = await as('s.hoffmann').get('/api/work-orders?pageSize=100&sort=createdAt&order=desc');
    const depots = new Set(res.body.items.map((wo: Summary) => wo.depot));
    expect(depots.size).toBeGreaterThan(1);
  });

  it('filtert nach mehreren Status', async () => {
    const res = await as('admin').get('/api/work-orders?status=open,waiting_parts&pageSize=100');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((wo: Summary) => ['open', 'waiting_parts'].includes(wo.status))).toBe(true);
  });

  it('findet Aufträge über die Fahrzeugnummer, auch ohne Leerzeichen', async () => {
    const res = await as('m.keller').get('/api/work-orders?q=423007');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((wo: Summary) => wo.vehicle.fleetNumber === '423 007')).toBe(true);
  });

  it('filtert überfällige Aufträge', async () => {
    const res = await as('admin').get('/api/work-orders?overdue=true&pageSize=100');
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.items.every((wo: Summary) => wo.overdue && wo.dueDate < TODAY)).toBe(true);
  });

  it('begrenzt die Seitengröße auf 100', async () => {
    const res = await as('admin').get('/api/work-orders?pageSize=500');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });

  it('behandelt Aufträge fremder Werke wie nicht vorhanden', async () => {
    const list = await as('m.keller').get('/api/work-orders?pageSize=1');
    const mucOrder = list.body.items[0].id;
    expect((await as('m.keller').get(`/api/work-orders/${mucOrder}`)).status).toBe(200);
    expect((await as('j.berger').get(`/api/work-orders/${mucOrder}`)).status).toBe(404);
  });

  it('liefert Details inklusive Ersatzteilsumme', async () => {
    const list = await as('admin').get('/api/work-orders?status=done&pageSize=100');
    const id = list.body.items[0].id;
    const res = await as('admin').get(`/api/work-orders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('description');
    expect(res.body).toHaveProperty('partsTotalEur');
    expect(res.body.allowedTransitions).toEqual([]);
  });
});

describe('GET /api/stats', () => {
  const { as } = setup();

  it('zählt aktive und überfällige Aufträge im Sichtbereich', async () => {
    const all = await as('admin').get('/api/stats');
    const nue = await as('j.berger').get('/api/stats');
    expect(all.body.active).toBeGreaterThan(nue.body.active);
    expect(nue.body.overdue).toBeLessThanOrEqual(nue.body.active);
  });
});
