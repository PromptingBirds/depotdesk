import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

const newOrder = {
  vehicleId: 'veh-442001',
  type: 'fault_repair',
  priority: 'high',
  title: 'Türstörung Wagen 2',
  description: 'Tür 3 rechts schließt nicht.',
  dueDate: '2026-10-08',
};

describe('Aufträge anlegen', () => {
  it('legt als Disposition einen offenen Auftrag an und protokolliert das', async () => {
    const { as, store } = setup();
    const res = await as('j.berger').post('/api/work-orders', newOrder);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'open', depot: 'NUE', createdBy: { id: 'j.berger' } });
    expect(res.body.id).toMatch(/^WO-2026-\d{6}$/);
    expect(store.listAudit().at(-1)).toMatchObject({ action: 'work_order.created', entityId: res.body.id });
  });

  it('verbietet Technik das Anlegen', async () => {
    const { as } = setup();
    const res = await as('a.yilmaz').post('/api/work-orders', newOrder);
    expect(res.status).toBe(403);
  });

  it('verbietet Fahrzeuge anderer Werke', async () => {
    const { as } = setup();
    const res = await as('m.keller').post('/api/work-orders', newOrder);
    expect(res.status).toBe(422);
  });

  it('validiert Pflichtfelder', async () => {
    const { as } = setup();
    const res = await as('j.berger').post('/api/work-orders', { ...newOrder, title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('title');
  });

  it('lehnt Fälligkeiten in der Vergangenheit ab', async () => {
    const { as } = setup();
    const res = await as('j.berger').post('/api/work-orders', { ...newOrder, dueDate: '2026-09-01' });
    expect(res.status).toBe(422);
  });
});

describe('Status ändern', () => {
  function findOrder(store: ReturnType<typeof setup>['store'], status: string, assigneeId: string) {
    const order = store.listWorkOrders().find((wo) => wo.status === status && wo.assigneeId === assigneeId);
    if (!order) throw new Error(`Kein Auftrag mit Status ${status} für ${assigneeId} in den Demo-Daten`);
    return order;
  }

  it('erlaubt Technik, eigene Aufträge abzuschließen', async () => {
    const { as, store } = setup();
    const order = findOrder(store, 'in_progress', 'a.yilmaz');
    const res = await as('a.yilmaz').post(`/api/work-orders/${order.id}/status`, { status: 'done', comment: 'erledigt' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
    expect(store.listAudit().at(-1)).toMatchObject({
      action: 'work_order.status_changed',
      details: { from: 'in_progress', to: 'done', comment: 'erledigt' },
    });
  });

  it('verbietet Technik fremde Aufträge', async () => {
    const { as, store } = setup();
    const order = store
      .listWorkOrders()
      .find((wo) => wo.depot === 'NUE' && wo.status === 'in_progress' && wo.assigneeId !== 'a.yilmaz')!;
    const res = await as('a.yilmaz').post(`/api/work-orders/${order.id}/status`, { status: 'done' });
    expect(res.status).toBe(403);
  });

  it('lehnt unzulässige Statuswechsel ab', async () => {
    const { as, store } = setup();
    const order = store.listWorkOrders().find((wo) => wo.depot === 'NUE' && wo.status === 'open')!;
    const res = await as('j.berger').post(`/api/work-orders/${order.id}/status`, { status: 'done' });
    expect(res.status).toBe(409);
  });

  it('verbietet dem Controlling Statusänderungen', async () => {
    const { as, store } = setup();
    const order = store.listWorkOrders().find((wo) => wo.status === 'open')!;
    const res = await as('s.hoffmann').post(`/api/work-orders/${order.id}/status`, { status: 'planned' });
    expect(res.status).toBe(403);
  });
});

describe('Zuweisen', () => {
  it('weist nur Techniker:innen des gleichen Werks zu', async () => {
    const { as, store } = setup();
    const order = store.listWorkOrders().find((wo) => wo.depot === 'NUE' && wo.status === 'open')!;
    expect((await as('j.berger').post(`/api/work-orders/${order.id}/assign`, { assigneeId: 'p.nowak' })).status).toBe(422);

    const res = await as('j.berger').post(`/api/work-orders/${order.id}/assign`, { assigneeId: 'a.yilmaz' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toEqual({ id: 'a.yilmaz', name: 'Ayşe Yılmaz' });
  });
});
