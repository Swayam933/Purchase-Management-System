import { Router } from 'express';
import itemTypeRoutes from './itemTypeRoutes.js';
import itemRoutes from './itemRoutes.js';
import purchaseRoutes from './purchaseRoutes.js';
import stockRoutes from './stockRoutes.js';
import { stats } from '../data/store.js';
import { config } from '../config/env.js';
import { ok } from '../utils/response.js';

const router = Router();

router.get('/health', (_req, res) =>
  ok(res, {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    storage: 'in-memory',
    lowStockThreshold: config.lowStockThreshold,
    records: stats(),
  }),
);

router.use('/item-types', itemTypeRoutes);
router.use('/items', itemRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/stock', stockRoutes);

export default router;
