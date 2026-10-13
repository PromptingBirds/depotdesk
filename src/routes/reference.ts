import { Router } from 'express';
import { z } from 'zod';
import { currentUser, requirePermission } from '../auth/authenticate.js';
import { canSeeDepot, permissionsOf } from '../auth/permissions.js';
import type { AppContext } from '../context.js';
import { PRIORITY_LABELS, ROLE_LABELS, STATUS_LABELS, TYPE_LABELS } from '../domain/labels.js';
import { ACTIVE_STATUSES } from '../domain/types.js';
import { workOrderStats } from '../services/workOrderService.js';

const depotFilter = z.object({ depot: z.string().optional() });

/** Stammdaten, Sitzung und Kennzahlen für die Oberfläche. */
export function referenceRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/me', (_req, res) => {
    const user = currentUser(res);
    res.json({ ...user, roleLabel: ROLE_LABELS[user.role], permissions: permissionsOf(user) });
  });

  router.get('/meta', (_req, res) => {
    res.json({
      statuses: STATUS_LABELS,
      activeStatuses: ACTIVE_STATUSES,
      types: TYPE_LABELS,
      priorities: PRIORITY_LABELS,
      roles: ROLE_LABELS,
    });
  });

  router.get('/depots', (_req, res) => {
    const user = currentUser(res);
    res.json(ctx.store.listDepots().filter((d) => canSeeDepot(user, d.code)));
  });

  router.get('/vehicles', (req, res) => {
    const user = currentUser(res);
    const { depot } = depotFilter.parse(req.query);
    const vehicles = ctx.store
      .listVehicles()
      .filter((v) => canSeeDepot(user, v.depot) && (!depot || v.depot === depot))
      .sort((a, b) => a.fleetNumber.localeCompare(b.fleetNumber));
    res.json(vehicles);
  });

  router.get('/technicians', requirePermission('work_orders:assign'), (req, res) => {
    const user = currentUser(res);
    const { depot } = depotFilter.parse(req.query);
    const technicians = ctx.store
      .listUsers()
      .filter((u) => u.role === 'technician' && u.depot && canSeeDepot(user, u.depot) && (!depot || u.depot === depot))
      .map(({ id, name, depot: home }) => ({ id, name, depot: home }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    res.json(technicians);
  });

  router.get('/stats', (_req, res) => {
    res.json(workOrderStats(ctx, currentUser(res)));
  });

  router.get('/audit', requirePermission('audit:read'), (req, res) => {
    const { entityId } = z.object({ entityId: z.string().optional() }).parse(req.query);
    const entries = ctx.store
      .listAudit()
      .filter((e) => !entityId || e.entityId === entityId)
      .reverse()
      .slice(0, 200);
    res.json(entries);
  });

  return router;
}
