import { Router } from 'express';
import itemTypeRoutes from './itemTypeRoutes.js';
import itemRoutes from './itemRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import stockRoutes from './stockRoutes.js';
import { databaseHealth } from '../data/mysql.js';
import { config } from '../config/env.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', (_req, res) =>
  ok(res, {
    message: 'Item & Purchase Management API',
    endpoints: {
      health: '/api/health',
      itemTypes: '/api/item-types',
      items: '/api/items',
      purchases: '/api/purchases',
      stock: '/api/stock',
    },
  }),
);

router.get('/health', asyncHandler(async (_req, res) =>
  ok(res, {
    ...(await databaseHealth()),
    uptimeSeconds: Math.round(process.uptime()),
    lowStockThreshold: config.lowStockThreshold,
  }),
));

router.use('/item-types', itemTypeRoutes);
router.use('/items', itemRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/stock', stockRoutes);

export default router;
