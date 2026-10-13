import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express, { type RequestHandler } from 'express';
import { authenticate } from './auth/authenticate.js';
import type { AppContext } from './context.js';
import { DEMO_USERS } from './data/seed.js';
import { ROLE_LABELS } from './domain/labels.js';
import { errorHandler, HttpError } from './lib/errors.js';
import { referenceRoutes } from './routes/reference.js';
import { workOrderRoutes } from './routes/workOrders.js';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

const requestLogger: RequestHandler = (req, res, next) => {
  const started = performance.now();
  res.on('finish', () => {
    const ms = (performance.now() - started).toFixed(0);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
};

export function createApp(ctx: AppContext) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  if (process.env.NODE_ENV !== 'test') app.use('/api', requestLogger);

  // Öffentlich, ohne Anmeldung
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version });
  });
  app.get('/api/demo-users', (_req, res) => {
    res.json(
      DEMO_USERS.map(({ id }) => ctx.store.getUser(id))
        .filter((u) => u !== undefined)
        .map((u) => ({ id: u.id, name: u.name, role: u.role, roleLabel: ROLE_LABELS[u.role], depot: u.depot })),
    );
  });

  // Ab hier nur mit Anmeldung
  app.use('/api', authenticate(ctx));
  app.use('/api', referenceRoutes(ctx));
  app.use('/api/work-orders', workOrderRoutes(ctx));
  app.use('/api', () => {
    throw new HttpError(404, 'not_found', 'Endpunkt nicht gefunden');
  });

  app.use(express.static(publicDir));
  app.use(errorHandler);
  return app;
}
