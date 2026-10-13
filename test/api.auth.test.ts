import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

describe('Anmeldung', () => {
  const { app, as } = setup();

  it('liefert Health-Check ohne Anmeldung', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('listet Demo-Nutzer ohne Anmeldung', async () => {
    const res = await request(app).get('/api/demo-users');
    expect(res.status).toBe(200);
    expect(res.body.map((u: { id: string }) => u.id)).toContain('j.berger');
  });

  it('lehnt Anfragen ohne Benutzer-Header ab', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('lehnt unbekannte Benutzer ab', async () => {
    const res = await as('unbekannt').get('/api/me');
    expect(res.status).toBe(401);
  });

  it('liefert Rolle und Berechtigungen des Nutzers', async () => {
    const res = await as('j.berger').get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 'j.berger', role: 'dispatcher', depot: 'NUE' });
    expect(res.body.permissions).toContain('work_orders:create');
  });

  it('beantwortet unbekannte API-Pfade mit 404', async () => {
    const res = await as('admin').get('/api/gibt-es-nicht');
    expect(res.status).toBe(404);
  });
});
