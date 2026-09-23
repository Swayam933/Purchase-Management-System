import { Router } from 'express';
import * as controller from '../controllers/purchaseController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.get('/next-order-id', asyncHandler(controller.nextOrderId));
router.get('/:id', asyncHandler(controller.getById));
router.put('/:id', asyncHandler(controller.update));

// No DELETE capability: answers 405 with an explanation (assignment section 8).
router.delete('/:id', asyncHandler(controller.rejectDelete));

export default router;
