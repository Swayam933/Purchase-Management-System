import { pool, transaction } from '../data/mysql.js';
import * as itemTypes from '../data/repositories/itemTypeRepository.js';
import { conflict, notFound } from '../utils/AppError.js';
import { toItemTypeDto } from './mappers.js';

export async function list() {
  return (await itemTypes.findAllWithItemCounts(pool)).map(toItemTypeDto);
}

export async function getById(id) {
  const row = await itemTypes.findById(pool, id);
  if (!row) throw notFound('Item type not found');
  return toItemTypeDto({ ...row, itemCount: await itemTypes.countItems(pool, id) });
}

export async function create({ typeName }) {
  return transaction(async (tx) => {
    if (await itemTypes.findByName(tx, typeName)) {
      throw conflict(`Item type "${typeName}" already exists`, [
        { field: 'typeName', message: 'This item type already exists' },
      ]);
    }
    return toItemTypeDto(await itemTypes.insert(tx, { typeName }));
  });
}

export async function update(id, { typeName }) {
  return transaction(async (tx) => {
    if (!await itemTypes.findById(tx, id)) throw notFound('Item type not found');
    if (await itemTypes.findByName(tx, typeName, { excludeId: id })) {
      throw conflict(`Item type "${typeName}" already exists`, [
        { field: 'typeName', message: 'This item type already exists' },
      ]);
    }
    return toItemTypeDto(await itemTypes.update(tx, id, { typeName }));
  });
}

export async function remove(id) {
  return transaction(async (tx) => {
    const row = await itemTypes.findById(tx, id);
    if (!row) throw notFound('Item type not found');

    const itemCount = await itemTypes.countItems(tx, id);
    if (itemCount > 0) {
      throw conflict(
        `Item type "${row.typeName}" is used by ${itemCount} item(s) and cannot be deleted`,
        [{ field: 'id', message: 'Reassign or remove those items first' }],
      );
    }
    await itemTypes.remove(tx, id);
    return { id, deleted: true };
  });
}
