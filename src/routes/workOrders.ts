import { Router } from 'express';
import { currentUser } from '../auth/authenticate.js';
import type { AppContext } from '../context.js';
import {
  assignSchema,
  assignWorkOrder,
  changeStatus,
  changeStatusSchema,
  createWorkOrder,
  createWorkOrderSchema,
  getWorkOrderDetail,
  listQuerySchema,
  listWorkOrders,
} from '../services/workOrderService.js';

export function workOrderRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const query = listQuerySchema.parse(req.query);
    res.json(listWorkOrders(ctx, currentUser(res), query));
  });

  router.post('/', (req, res) => {
    const input = createWorkOrderSchema.parse(req.body);
    res.status(201).json(createWorkOrder(ctx, currentUser(res), input));
  });

  router.get('/:id', (req, res) => {
    res.json(getWorkOrderDetail(ctx, currentUser(res), req.params.id));
  });

  router.post('/:id/status', (req, res) => {
    const input = changeStatusSchema.parse(req.body);
    res.json(changeStatus(ctx, currentUser(res), req.params.id, input));
  });

  router.post('/:id/assign', (req, res) => {
    const input = assignSchema.parse(req.body);
    res.json(assignWorkOrder(ctx, currentUser(res), req.params.id, input));
  });

  return router;
}
