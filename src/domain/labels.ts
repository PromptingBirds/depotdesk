import type { Priority, Role, WorkOrderStatus, WorkOrderType } from './types.js';

// Anzeigetexte für die Oberfläche. Die API arbeitet mit den englischen Schlüsseln.

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  open: 'Offen',
  planned: 'Eingeplant',
  in_progress: 'In Arbeit',
  waiting_parts: 'Wartet auf Teile',
  done: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export const TYPE_LABELS: Record<WorkOrderType, string> = {
  inspection: 'Fristarbeit',
  brake_test: 'Bremse',
  wheelset: 'Radsatz',
  fault_repair: 'Störung',
  damage: 'Schaden',
  hvac: 'Klima/Heizung',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  critical: 'Kritisch',
};

export const ROLE_LABELS: Record<Role, string> = {
  viewer: 'Controlling (lesend)',
  technician: 'Technik',
  dispatcher: 'Disposition',
  admin: 'Administration',
};
