import { existsSync } from 'node:fs';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { Store } from './data/store.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig();
const store = Store.seeded({ seed: config.seed, referenceDate: config.seedReferenceDate });
const app = createApp({ store, now: () => new Date(), authHeader: config.authHeader });

app.listen(config.port, () => {
  const orders = store.listWorkOrders().length.toLocaleString('de-DE');
  console.log(`DepotDesk läuft auf http://localhost:${config.port} (${orders} Demo-Aufträge, Seed ${config.seed})`);
});
