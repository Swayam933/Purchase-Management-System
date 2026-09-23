import { Validator, isPlainObject } from './validate.js';
import { badRequest } from '../utils/AppError.js';

const ORDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

/**
 * Validates the purchase line array shared by create and update.
 *
 * Duplicate item ids inside one order are **rejected** (assignment section 5
 * allows either rejecting or merging; rejecting is explicit and keeps one row
 * per item in purchase_items). The frontend merges quantities as the line is
 * added, so a duplicate only reaches the API from a hand-written request.
 */
function validateLines(v, rawItems) {
  const items = v.array(rawItems, 'items', {
    min: 1,
    message: 'Purchase must contain at least one item',
    label: 'Items',
  });
  if (!items) return [];

  const seen = new Map();
  const lines = [];

  items.forEach((entry, index) => {
    const path = `items[${index}]`;

    if (!isPlainObject(entry)) {
      v.fail(path, 'Each purchase line must be an object with itemId and quantity');
      return;
    }

    const itemId = v.integer(entry.itemId ?? entry.item_id, `${path}.itemId`, {
      min: 1,
      message: 'Item is required',
      label: 'Item',
    });

    const quantity = v.integer(entry.quantity ?? entry.qty, `${path}.quantity`, {
      min: 1,
      message: 'Quantity is required',
      tooSmallMessage: 'Quantity must be greater than zero',
      label: 'Quantity',
    });

    if (itemId === undefined || quantity === undefined) return;

    if (seen.has(itemId)) {
      v.fail(
        `${path}.itemId`,
        `Duplicate item in order: this item is already on line ${seen.get(itemId) + 1}`,
      );
      return;
    }

    seen.set(itemId, index);
    lines.push({ itemId, quantity });
  });

  return lines;
}

/** POST /api/purchases */
export function validateCreatePurchasePayload(body) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const v = new Validator();

  // order_id is optional: the backend generates the next PO-##### when omitted.
  let orderId;
  const rawOrderId = body.orderId ?? body.order_id;
  if (rawOrderId !== undefined && rawOrderId !== null && String(rawOrderId).trim() !== '') {
    orderId = v.string(rawOrderId, 'orderId', { max: 30, label: 'Order ID' });
    if (orderId && !ORDER_ID_PATTERN.test(orderId)) {
      v.fail(
        'orderId',
        'Order ID must be 3-30 characters using letters, numbers, dot, dash or underscore',
      );
    }
  }

  const purchaseDate = v.date(body.purchaseDate ?? body.purchase_date, 'purchaseDate', {
    message: 'Purchase date is required',
    label: 'Purchase date',
  });

  const items = validateLines(v, body.items);

  v.throwIfInvalid();

  return { orderId, purchaseDate, items };
}

/**
 * PUT /api/purchases/:id
 *
 * `items` is the complete new line set for the order. Omitting it leaves the
 * lines untouched and only updates the header.
 */
export function validateUpdatePurchasePayload(body) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const v = new Validator();

  const purchaseDate = v.date(body.purchaseDate ?? body.purchase_date, 'purchaseDate', {
    required: false,
    label: 'Purchase date',
  });

  const hasItems = body.items !== undefined;
  const items = hasItems ? validateLines(v, body.items) : undefined;

  if (purchaseDate === undefined && !hasItems) {
    v.fail('body', 'Provide purchaseDate and/or items to update');
  }

  v.throwIfInvalid();

  return { purchaseDate, items };
}

/** GET /api/purchases?q=&from=&to= */
export function parsePurchaseFilters(query) {
  const v = new Validator();
  const filters = {};

  if (query.q) filters.q = String(query.q).trim();
  if (query.from) filters.from = v.date(query.from, 'from', { label: 'From date' });
  if (query.to) filters.to = v.date(query.to, 'to', { label: 'To date' });

  v.throwIfInvalid('Invalid query parameters');
  return filters;
}
