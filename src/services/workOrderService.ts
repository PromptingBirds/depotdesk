import { z } from 'zod';
import { can, canSeeDepot, depotScope } from '../auth/permissions.js';
import type { AppContext } from '../context.js';
import { STATUS_LABELS } from '../domain/labels.js';
import {
  ACTIVE_STATUSES,
  PRIORITIES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_TYPES,
  type PartUsage,
  type Priority,
  type User,
  type WorkOrder,
  type WorkOrderStatus,
} from '../domain/types.js';
import { canTransition, isFinal, nextStatuses } from '../domain/workOrderStatus.js';
import { toDepotDate } from '../lib/dates.js';
import { conflict, forbidden, HttpError, notFound } from '../lib/errors.js';
import { partsTotalEur } from '../lib/money.js';

// ---------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------

/** Erlaubt `?status=open,planned` und `?status=open&status=planned`. */
const commaList = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.join(',') : value),
    z
      .string()
      .transform((value) => value.split(',').map((v) => v.trim()).filter(Boolean))
      .pipe(z.array(z.enum(values)).min(1)),
  );

export const listQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: commaList(WORK_ORDER_STATUSES).optional(),
  type: z.enum(WORK_ORDER_TYPES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  depot: z.string().optional(),
  /** Benutzerkennung oder `me` */
  assignee: z.string().optional(),
  dueFrom: z.iso.date().optional(),
  dueTo: z.iso.date().optional(),
  overdue: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  sort: z.enum(['dueDate', 'createdAt', 'priority', 'id']).default('dueDate'),
  order: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const createWorkOrderSchema = z.object({
  vehicleId: z.string().min(1),
  type: z.enum(WORK_ORDER_TYPES),
  priority: z.enum(PRIORITIES).default('normal'),
  title: z.string().trim().min(3).max(120),
  description: z.string().max(4000).default(''),
  dueDate: z.iso.date(),
  assigneeId: z.string().nullable().optional(),
});

export const changeStatusSchema = z.object({
  status: z.enum(WORK_ORDER_STATUSES),
  comment: z.string().trim().max(500).optional(),
});

export const assignSchema = z.object({
  assigneeId: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Ausgaben
// ---------------------------------------------------------------------------

export interface WorkOrderSummary {
  id: string;
  title: string;
  type: WorkOrder['type'];
  priority: Priority;
  status: WorkOrderStatus;
  depot: string;
  vehicle: { id: string; fleetNumber: string; series: string };
  assignee: { id: string; name: string } | null;
  dueDate: string;
  plannedStart: string | null;
  updatedAt: string;
  overdue: boolean;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  description: string;
  createdAt: string;
  createdBy: { id: string; name: string };
  completedAt: string | null;
  laborHours: number;
  parts: PartUsage[];
  partsTotalEur: number;
  /** Statuswechsel, die der aktuelle Nutzer auslösen darf */
  allowedTransitions: WorkOrderStatus[];
  canAssign: boolean;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

const PRIORITY_RANK: Record<Priority, number> = { critical: 0, high: 1, normal: 2, low: 3 };

/** Sichtbare, gefilterte und sortierte Aufträge, ohne Seitenaufteilung. */
export function findWorkOrders(ctx: AppContext, user: User, query: ListQuery): WorkOrder[] {
  const scope = depotScope(user);
  const today = toDepotDate(ctx.now());
  const assignee = query.assignee === 'me' ? user.id : query.assignee;
  const needle = query.q?.toLowerCase();
  const needleCompact = needle?.replace(/\s+/g, '');

  const result = ctx.store.listWorkOrders().filter((wo) => {
    if (scope !== 'all' && !scope.includes(wo.depot)) return false;
    if (query.depot && wo.depot !== query.depot) return false;
    if (query.status && !query.status.includes(wo.status)) return false;
    if (query.type && wo.type !== query.type) return false;
    if (query.priority && wo.priority !== query.priority) return false;
    if (assignee && wo.assigneeId !== assignee) return false;
    if (query.dueFrom && wo.dueDate < query.dueFrom) return false;
    if (query.dueTo && wo.dueDate > query.dueTo) return false;
    if (query.overdue !== undefined && isOverdue(wo, today) !== query.overdue) return false;
    if (needle) {
      const fleetNumber = ctx.store.getVehicle(wo.vehicleId)?.fleetNumber.replace(/\s+/g, '') ?? '';
      const haystack = `${wo.id} ${wo.title}`.toLowerCase();
      if (!haystack.includes(needle) && !fleetNumber.includes(needleCompact!)) return false;
    }
    return true;
  });

  const direction = query.order === 'asc' ? 1 : -1;
  return result.sort((a, b) => {
    const primary =
      query.sort === 'priority'
        ? PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
        : a[query.sort].localeCompare(b[query.sort]);
    return (primary || a.id.localeCompare(b.id)) * direction;
  });
}

export function listWorkOrders(ctx: AppContext, user: User, query: ListQuery): Page<WorkOrderSummary> {
  const all = findWorkOrders(ctx, user, query);
  const start = (query.page - 1) * query.pageSize;
  return {
    items: all.slice(start, start + query.pageSize).map((wo) => toSummary(ctx, wo)),
    page: query.page,
    pageSize: query.pageSize,
    total: all.length,
  };
}

export function getWorkOrderDetail(ctx: AppContext, user: User, id: string): WorkOrderDetail {
  return toDetail(ctx, user, loadVisible(ctx, user, id));
}

export function workOrderStats(ctx: AppContext, user: User) {
  const scope = depotScope(user);
  const today = toDepotDate(ctx.now());
  const byStatus = Object.fromEntries(ACTIVE_STATUSES.map((s) => [s, 0])) as Record<WorkOrderStatus, number>;
  let overdue = 0;
  for (const wo of ctx.store.listWorkOrders()) {
    if (scope !== 'all' && !scope.includes(wo.depot)) continue;
    if (!ACTIVE_STATUSES.includes(wo.status)) continue;
    byStatus[wo.status] += 1;
    if (isOverdue(wo, today)) overdue += 1;
  }
  const active = ACTIVE_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  return { active, overdue, byStatus };
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export function createWorkOrder(
  ctx: AppContext,
  user: User,
  input: z.infer<typeof createWorkOrderSchema>,
): WorkOrderDetail {
  if (!can(user, 'work_orders:create')) throw forbidden();

  const vehicle = ctx.store.getVehicle(input.vehicleId);
  if (!vehicle || !canSeeDepot(user, vehicle.depot)) {
    throw new HttpError(422, 'invalid_vehicle', 'Fahrzeug unbekannt oder nicht in Ihrem Werk');
  }
  const now = ctx.now();
  if (input.dueDate < toDepotDate(now)) {
    throw new HttpError(422, 'invalid_due_date', 'Fälligkeit darf nicht in der Vergangenheit liegen');
  }
  if (input.assigneeId) assertAssignable(ctx, input.assigneeId, vehicle.depot);

  const timestamp = now.toISOString();
  const order: WorkOrder = {
    id: ctx.store.nextWorkOrderId(now.getUTCFullYear()),
    title: input.title,
    description: input.description,
    type: input.type,
    priority: input.priority,
    status: 'open',
    depot: vehicle.depot,
    vehicleId: vehicle.id,
    assigneeId: input.assigneeId ?? null,
    createdBy: user.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    plannedStart: null,
    completedAt: null,
    dueDate: input.dueDate,
    laborHours: 0,
    parts: [],
  };
  ctx.store.saveWorkOrder(order);
  ctx.store.appendAudit({
    at: timestamp,
    userId: user.id,
    action: 'work_order.created',
    entityId: order.id,
    details: { depot: order.depot, vehicleId: order.vehicleId, type: order.type },
  });
  return toDetail(ctx, user, order);
}

export function changeStatus(
  ctx: AppContext,
  user: User,
  id: string,
  input: z.infer<typeof changeStatusSchema>,
): WorkOrderDetail {
  const order = loadVisible(ctx, user, id);
  if (!mayChangeStatus(user, order)) {
    throw forbidden('Statusänderungen sind nur für zugewiesene Aufträge möglich');
  }
  if (!canTransition(order.status, input.status)) {
    throw conflict(
      `Statuswechsel von "${STATUS_LABELS[order.status]}" nach "${STATUS_LABELS[input.status]}" ist nicht erlaubt`,
    );
  }
  if (input.status === 'in_progress' && !order.assigneeId) {
    throw conflict('Auftrag ist niemandem zugewiesen');
  }

  const timestamp = ctx.now().toISOString();
  const updated: WorkOrder = {
    ...order,
    status: input.status,
    updatedAt: timestamp,
    plannedStart: input.status === 'planned' ? (order.plannedStart ?? timestamp) : order.plannedStart,
    completedAt: input.status === 'done' ? timestamp : order.completedAt,
  };
  ctx.store.saveWorkOrder(updated);
  ctx.store.appendAudit({
    at: timestamp,
    userId: user.id,
    action: 'work_order.status_changed',
    entityId: order.id,
    details: { from: order.status, to: input.status, comment: input.comment ?? null },
  });
  return toDetail(ctx, user, updated);
}

export function assignWorkOrder(
  ctx: AppContext,
  user: User,
  id: string,
  input: z.infer<typeof assignSchema>,
): WorkOrderDetail {
  if (!can(user, 'work_orders:assign')) throw forbidden();
  const order = loadVisible(ctx, user, id);
  if (isFinal(order.status)) throw conflict('Abgeschlossene oder stornierte Aufträge können nicht neu zugewiesen werden');
  if (input.assigneeId) assertAssignable(ctx, input.assigneeId, order.depot);

  const timestamp = ctx.now().toISOString();
  const updated: WorkOrder = { ...order, assigneeId: input.assigneeId, updatedAt: timestamp };
  ctx.store.saveWorkOrder(updated);
  ctx.store.appendAudit({
    at: timestamp,
    userId: user.id,
    action: 'work_order.assigned',
    entityId: order.id,
    details: { from: order.assigneeId, to: input.assigneeId },
  });
  return toDetail(ctx, user, updated);
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

export function isOverdue(order: WorkOrder, today: string): boolean {
  return ACTIVE_STATUSES.includes(order.status) && order.dueDate < today;
}

/** Aufträge anderer Werke werden wie nicht vorhanden behandelt (404 statt 403), um nichts preiszugeben. */
function loadVisible(ctx: AppContext, user: User, id: string): WorkOrder {
  const order = ctx.store.getWorkOrder(id);
  if (!order || !canSeeDepot(user, order.depot)) throw notFound('Auftrag');
  return order;
}

function mayChangeStatus(user: User, order: WorkOrder): boolean {
  if (!can(user, 'work_orders:update_status')) return false;
  return user.role !== 'technician' || order.assigneeId === user.id;
}

function assertAssignable(ctx: AppContext, assigneeId: string, depot: string): void {
  const assignee = ctx.store.getUser(assigneeId);
  if (!assignee || assignee.role !== 'technician' || assignee.depot !== depot) {
    throw new HttpError(422, 'invalid_assignee', 'Zuweisung nur an Techniker:innen des gleichen Werks möglich');
  }
}

function toSummary(ctx: AppContext, wo: WorkOrder): WorkOrderSummary {
  const vehicle = ctx.store.getVehicle(wo.vehicleId)!;
  const assignee = wo.assigneeId ? ctx.store.getUser(wo.assigneeId) : undefined;
  return {
    id: wo.id,
    title: wo.title,
    type: wo.type,
    priority: wo.priority,
    status: wo.status,
    depot: wo.depot,
    vehicle: { id: vehicle.id, fleetNumber: vehicle.fleetNumber, series: vehicle.series },
    assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
    dueDate: wo.dueDate,
    plannedStart: wo.plannedStart,
    updatedAt: wo.updatedAt,
    overdue: isOverdue(wo, toDepotDate(ctx.now())),
  };
}

function toDetail(ctx: AppContext, user: User, wo: WorkOrder): WorkOrderDetail {
  const creator = ctx.store.getUser(wo.createdBy);
  return {
    ...toSummary(ctx, wo),
    description: wo.description,
    createdAt: wo.createdAt,
    createdBy: { id: wo.createdBy, name: creator?.name ?? wo.createdBy },
    completedAt: wo.completedAt,
    laborHours: wo.laborHours,
    parts: wo.parts,
    partsTotalEur: partsTotalEur(wo.parts),
    allowedTransitions: mayChangeStatus(user, wo) ? [...nextStatuses(wo.status)] : [],
    canAssign: can(user, 'work_orders:assign') && !isFinal(wo.status),
  };
}
