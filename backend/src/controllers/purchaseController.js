import * as purchaseService from '../services/purchaseService.js';
import {
  parsePurchaseFilters,
  validateCreatePurchasePayload,
  validateUpdatePurchasePayload,
} from '../validators/purchaseValidator.js';
import { parseId } from '../validators/validate.js';
import { created, ok } from '../utils/response.js';
import { methodNotAllowed } from '../utils/AppError.js';

export const list = async (req, res) => {
  const filters = parsePurchaseFilters(req.query);
  const data = await purchaseService.list(filters);
  ok(res, data, { count: data.length, filters });
};

export const getById = async (req, res) => {
  ok(res, await purchaseService.getById(parseId(req.params.id, 'purchase id')));
};

/** Order ID the next created purchase will receive, for display on the form. */
export const nextOrderId = async (_req, res) => {
  ok(res, { orderId: await purchaseService.peekNextOrderId() });
};

export const create = async (req, res) => {
  const payload = validateCreatePurchasePayload(req.body);
  created(res, await purchaseService.create(payload));
};

export const update = async (req, res) => {
  const id = parseId(req.params.id, 'purchase id');
  const payload = validateUpdatePurchasePayload(req.body);
  ok(res, await purchaseService.update(id, payload));
};

/**
 * Purchase deletion is not supported (assignment section 8).
 *
 * The route exists only to answer with an explicit, documented 405 instead of a
 * confusing "route not found". There is no deletion code path behind it.
 */
export const rejectDelete = async () => {
  throw methodNotAllowed(
    'Purchases are historical transactions and cannot be deleted. Update the purchase instead.',
  );
};
