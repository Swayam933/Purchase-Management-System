import { Validator, isPlainObject } from './validate.js';
import { badRequest } from '../utils/AppError.js';
import { AVAILABILITY } from '../utils/stock.js';

const AVAILABILITY_VALUES = Object.values(AVAILABILITY);

/**
 * Item master payload (assignment sections 3.1 and 5).
 *
 * - name            required
 * - itemTypeId      required (existence is checked by the service)
 * - purchaseDate    required, valid YYYY-MM-DD
 * - stockAvailable  required, integer, never negative
 * - active          optional, defaults to true
 */
export function validateItemPayload(body, { partial = false } = {}) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const v = new Validator();
  const required = !partial;

  const name = v.string(body.name ?? body.itemName, 'name', {
    required,
    max: 150,
    message: 'Item name is required',
    label: 'Item name',
  });

  const itemTypeId = v.integer(body.itemTypeId ?? body.item_type_id, 'itemTypeId', {
    required,
    min: 1,
    message: 'Item type is required',
    label: 'Item type',
  });

  const purchaseDate = v.date(body.purchaseDate ?? body.purchase_date, 'purchaseDate', {
    required,
    message: 'Purchase date is required',
    label: 'Purchase date',
  });

  const stockAvailable = v.integer(
    body.stockAvailable ?? body.stock_available ?? body.stock,
    'stockAvailable',
    {
      required,
      min: 0,
      message: 'Stock available is required',
      tooSmallMessage: 'Stock cannot be negative',
      label: 'Stock available',
    },
  );

  const active = v.boolean(body.active, 'active', {
    defaultValue: partial ? undefined : true,
    label: 'Status',
  });

  v.throwIfInvalid();

  return { name, itemTypeId, purchaseDate, stockAvailable, active };
}

/** PATCH /api/items/:id/status */
export function validateStatusPayload(body) {
  if (!isPlainObject(body)) throw badRequest('Request body must be a JSON object');

  const v = new Validator();
  const active = v.boolean(body.active, 'active', { required: true, label: 'Status' });
  v.throwIfInvalid();

  return { active };
}

/** GET /api/items?q=&itemTypeId=&active=&availability= */
export function parseItemFilters(query) {
  const v = new Validator();
  const filters = {};

  if (query.q) filters.q = String(query.q).trim();

  if (query.itemTypeId !== undefined && query.itemTypeId !== '') {
    filters.itemTypeId = v.integer(query.itemTypeId, 'itemTypeId', { min: 1, label: 'Item type' });
  }

  if (query.active !== undefined && query.active !== '' && query.active !== 'all') {
    filters.active = v.boolean(query.active, 'active', { required: true, label: 'Status' });
  }

  if (query.availability !== undefined && query.availability !== '' && query.availability !== 'all') {
    const availability = String(query.availability);
    if (!AVAILABILITY_VALUES.includes(availability)) {
      v.fail('availability', `availability must be one of: ${AVAILABILITY_VALUES.join(', ')}`);
    } else {
      filters.availability = availability;
    }
  }

  v.throwIfInvalid('Invalid query parameters');
  return filters;
}
