import type { WorkOrderStatus } from './types.js';

/**
 * Erlaubte Statuswechsel. Siehe docs/domain.md, Abschnitt "Lebenszyklus eines Auftrags".
 * Abgeschlossene und stornierte Aufträge sind final.
 */
const TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  open: ['planned', 'cancelled'],
  planned: ['open', 'in_progress', 'cancelled'],
  in_progress: ['waiting_parts', 'done', 'cancelled'],
  waiting_parts: ['in_progress', 'cancelled'],
  done: [],
  cancelled: [],
};

export function nextStatuses(from: WorkOrderStatus): readonly WorkOrderStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isFinal(status: WorkOrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
