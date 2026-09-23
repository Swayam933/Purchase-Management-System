import { Router } from 'express';
import * as controller from '../controllers/stockController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.overview));

export default router;
