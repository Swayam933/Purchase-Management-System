import { pool, transaction } from '../data/mysql.js';
import * as items from '../data/repositories/itemRepository.js';
import * as itemTypes from '../data/repositories/itemTypeRepository.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { toItemDto } from './mappers.js';

async function assertItemTypeExists(tx, itemTypeId) {
  if (!await itemTypes.findById(tx, itemTypeId)) {
    throw badRequest('Invalid item type', [
      { field: 'itemTypeId', message: 'Selected item type does not exist' },
    ]);
  }
}

async function assertNameAvailable(tx, name, excludeId = null) {
  if (await items.findByName(tx, name, { excludeId })) {
    throw conflict(`An item named "${name}" already exists`, [
      { field: 'name', message: 'This item name is already in use' },
    ]);
  }
}

export async function list(filters = {}) {
  return (await items.findAllWithType(pool, filters)).map(toItemDto);
}

export async function getById(id) {
  const row = await items.findByIdWithType(pool, id);
  if (!row) throw notFound('Item not found');

  const history = await items.findPurchaseHistory(pool, id);
  return {
    ...toItemDto(row),
    purchaseHistory: history,
    totalPurchased: history.reduce((sum, entry) => sum + Number(entry.quantity), 0),
    canDelete: history.length === 0,
  };
}

export async function create(payload) {
  return transaction(async (tx) => {
    await assertItemTypeExists(tx, payload.itemTypeId);
    await assertNameAvailable(tx, payload.name);
    const row = await items.insert(tx, {
      ...payload,
      active: payload.active ?? true,
    });
    return toItemDto(await items.findByIdWithType(tx, row.id));
  });
}

export async function update(id, payload) {
  return transaction(async (tx) => {
    if (!await items.findById(tx, id, { forUpdate: true })) throw notFound('Item not found');

    if (payload.itemTypeId !== undefined) await assertItemTypeExists(tx, payload.itemTypeId);
    if (payload.name !== undefined) await assertNameAvailable(tx, payload.name, id);

    await items.update(tx, id, payload);
    return toItemDto(await items.findByIdWithType(tx, id));
  });
}

export async function setActive(id, active) {
  return transaction(async (tx) => {
    if (!await items.findById(tx, id, { forUpdate: true })) throw notFound('Item not found');
    await items.update(tx, id, { active });
    return toItemDto(await items.findByIdWithType(tx, id));
  });
}

export async function remove(id) {
  return transaction(async (tx) => {
    const row = await items.findById(tx, id, { forUpdate: true });
    if (!row) throw notFound('Item not found');

    const usageCount = await items.countPurchaseLines(tx, id);
    if (usageCount > 0) {
      throw conflict(
        `"${row.name}" appears in ${usageCount} purchase(s) and cannot be deleted. Mark it inactive instead.`,
        [{ field: 'id', message: 'Deleting this item would break purchase history' }],
      );
    }

    await items.remove(tx, id);
    return { id, deleted: true };
  });
}
