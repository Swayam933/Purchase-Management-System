import { Router } from 'express';
import * as controller from '../controllers/itemController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.getById));
router.put('/:id', asyncHandler(controller.update));
router.patch('/:id/status', asyncHandler(controller.updateStatus));
router.delete('/:id', asyncHandler(controller.remove));

export default router;
