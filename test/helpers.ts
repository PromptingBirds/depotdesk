import request from 'supertest';
import { createApp } from '../src/app.js';
import { Store } from '../src/data/store.js';

export const AUTH_HEADER = 'x-depotdesk-user';
/** Fester Stichtag, damit Tests unabhängig vom aktuellen Datum sind. */
export const REFERENCE_DATE = new Date('2026-10-01T08:00:00Z');
export const TODAY = '2026-10-01';

export function setup() {
  const store = Store.seeded({ seed: 42, referenceDate: REFERENCE_DATE });
  const app = createApp({ store, now: () => REFERENCE_DATE, authHeader: AUTH_HEADER });
  const as = (userId: string) => ({
    get: (url: string) => request(app).get(url).set(AUTH_HEADER, userId),
    post: (url: string, body?: object) => request(app).post(url).set(AUTH_HEADER, userId).send(body),
  });
  return { app, store, as };
}
