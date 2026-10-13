export const ROLES = ['viewer', 'technician', 'dispatcher', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const WORK_ORDER_TYPES = ['inspection', 'brake_test', 'wheelset', 'fault_repair', 'damage', 'hvac'] as const;
export type WorkOrderType = (typeof WORK_ORDER_TYPES)[number];

export const PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const WORK_ORDER_STATUSES = ['open', 'planned', 'in_progress', 'waiting_parts', 'done', 'cancelled'] as const;
export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

/** Status, in denen ein Auftrag noch bearbeitet wird. */
export const ACTIVE_STATUSES: readonly WorkOrderStatus[] = ['open', 'planned', 'in_progress', 'waiting_parts'];

export interface Depot {
  /** Kurzzeichen, z. B. "NUE" */
  code: string;
  name: string;
  city: string;
}

export interface User {
  /** Login-Kennung, z. B. "j.berger" */
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Heimatwerk. `null` bei werksübergreifenden Rollen (Controlling, Administration). */
  depot: string | null;
}

export interface Vehicle {
  id: string;
  /** Betriebsnummer, z. B. "440 027" */
  fleetNumber: string;
  series: string;
  depot: string;
  mileageKm: number;
  /** ISO-Datum (YYYY-MM-DD) */
  commissionedOn: string;
}

export interface PartUsage {
  partNumber: string;
  description: string;
  quantity: number;
  unitPriceEur: number;
}

export interface WorkOrder {
  /** Fachliche Auftragsnummer, z. B. "WO-2026-004711" */
  id: string;
  title: string;
  description: string;
  type: WorkOrderType;
  priority: Priority;
  status: WorkOrderStatus;
  depot: string;
  vehicleId: string;
  assigneeId: string | null;
  createdBy: string;
  /** Zeitstempel immer ISO 8601 in UTC */
  createdAt: string;
  updatedAt: string;
  plannedStart: string | null;
  completedAt: string | null;
  /** Fälligkeitsdatum (YYYY-MM-DD), bezogen auf die Ortszeit des Werks */
  dueDate: string;
  laborHours: number;
  parts: PartUsage[];
}

export type AuditAction = 'work_order.created' | 'work_order.status_changed' | 'work_order.assigned';

export interface AuditEntry {
  id: number;
  at: string;
  userId: string;
  action: AuditAction;
  entityId: string;
  details: Record<string, unknown>;
}
