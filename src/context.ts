import type { Store } from './data/store.js';

/** Abhängigkeiten, die Routen und Services gemeinsam nutzen. `now` ist injizierbar, damit Tests deterministisch sind. */
export interface AppContext {
  store: Store;
  now: () => Date;
  authHeader: string;
}
