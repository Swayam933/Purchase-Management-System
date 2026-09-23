import { db, transaction } from '../data/store.js';
import * as items from '../data/repositories/itemRepository.js';
import * as itemTypes from '../data/repositories/itemTypeRepository.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { toItemDto } from './mappers.js';

/** Item type must exist before an item can point at it (assignment section 5). */
function assertItemTypeExists(tx, itemTypeId) {
  if (!itemTypes.findById(tx, itemTypeId)) {
    throw badRequest('Invalid item type', [
      { field: 'itemTypeId', message: 'Selected item type does not exist' },
    ]);
  }
}

function assertNameAvailable(tx, name, excludeId = null) {
  if (items.findByName(tx, name, { excludeId })) {
    throw conflict(`An item named "${name}" already exists`, [
      { field: 'name', message: 'This item name is already in use' },
    ]);
  }
}

/** Item list joined to item_types. */
export function list(filters = {}) {
  return items.findAllWithType(db, filters).map(toItemDto);
}

/** Item details plus its purchase history and whether deletion is permitted. */
export function getById(id) {
  const row = items.findByIdWithType(db, id);
  if (!row) throw notFound('Item not found');

  const history = items.findPurchaseHistory(db, id);
  const totalPurchased = history.reduce((sum, entry) => sum + entry.quantity, 0);

  return {
    ...toItemDto(row),
    purchaseHistory: history,
    totalPurchased,
    /** Deletion is blocked once the item appears in any purchase (section 9). */
    canDelete: history.length === 0,
  };
}

export async function create(payload) {
  return transaction((tx) => {
    assertItemTypeExists(tx, payload.itemTypeId);
    assertNameAvailable(tx, payload.name);

    const row = items.insert(tx, {
      name: payload.name,
      itemTypeId: payload.itemTypeId,
      purchaseDate: payload.purchaseDate,
      stockAvailable: payload.stockAvailable,
      active: payload.active ?? true,
    });

    return toItemDto(items.findByIdWithType(tx, row.id));
  });
}

export async function update(id, payload) {
  return transaction((tx) => {
    if (!items.findById(tx, id)) throw notFound('Item not found');

    if (payload.itemTypeId !== undefined) assertItemTypeExists(tx, payload.itemTypeId);
    if (payload.name !== undefined) assertNameAvailable(tx, payload.name, id);

    items.update(tx, id, {
      name: payload.name,
      itemTypeId: payload.itemTypeId,
      purchaseDate: payload.purchaseDate,
      stockAvailable: payload.stockAvailable,
      active: payload.active,
    });

    return toItemDto(items.findByIdWithType(tx, id));
  });
}

/** Activate / deactivate. Inactive items stay visible in purchase history. */
export async function setActive(id, active) {
  return transaction((tx) => {
    if (!items.findById(tx, id)) throw notFound('Item not found');
    items.update(tx, id, { active });
    return toItemDto(items.findByIdWithType(tx, id));
  });
}

/**
 * Item deletion rule (assignment section 9): an item that already appears in a
 * purchase must be kept and deactivated instead, so purchase history stays
 * intact.
 */
export async function remove(id) {
  return transaction((tx) => {
    const row = items.findById(tx, id);
    if (!row) throw notFound('Item not found');

    const usageCount = items.countPurchaseLines(tx, id);
    if (usageCount > 0) {
      throw conflict(
        `"${row.name}" appears in ${usageCount} purchase(s) and cannot be deleted. Mark it inactive instead.`,
        [{ field: 'id', message: 'Deleting this item would break purchase history' }],
      );
    }

    items.remove(tx, id);
    return { id, deleted: true };
  });
}
