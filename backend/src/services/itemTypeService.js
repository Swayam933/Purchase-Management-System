import { db, transaction } from '../data/store.js';
import * as itemTypes from '../data/repositories/itemTypeRepository.js';
import { conflict, notFound } from '../utils/AppError.js';
import { toItemTypeDto } from './mappers.js';

/** Item types with their item counts (LEFT JOIN + GROUP BY equivalent). */
export function list() {
  return itemTypes.findAllWithItemCounts(db).map(toItemTypeDto);
}

export function getById(id) {
  const row = itemTypes.findById(db, id);
  if (!row) throw notFound('Item type not found');
  return toItemTypeDto({
    ...row,
    itemCount: itemTypes.countItems(db, id),
  });
}

export async function create({ typeName }) {
  return transaction((tx) => {
    if (itemTypes.findByName(tx, typeName)) {
      throw conflict(`Item type "${typeName}" already exists`, [
        { field: 'typeName', message: 'This item type already exists' },
      ]);
    }
    return toItemTypeDto(itemTypes.insert(tx, { typeName }));
  });
}

export async function update(id, { typeName }) {
  return transaction((tx) => {
    if (!itemTypes.findById(tx, id)) throw notFound('Item type not found');

    if (itemTypes.findByName(tx, typeName, { excludeId: id })) {
      throw conflict(`Item type "${typeName}" already exists`, [
        { field: 'typeName', message: 'This item type already exists' },
      ]);
    }

    return toItemTypeDto(itemTypes.update(tx, id, { typeName }));
  });
}

/**
 * An item type in use by items cannot be removed: that would orphan the
 * `items.item_type_id` foreign key (ON DELETE RESTRICT).
 */
export async function remove(id) {
  return transaction((tx) => {
    const row = itemTypes.findById(tx, id);
    if (!row) throw notFound('Item type not found');

    const itemCount = itemTypes.countItems(tx, id);
    if (itemCount > 0) {
      throw conflict(
        `Item type "${row.typeName}" is used by ${itemCount} item(s) and cannot be deleted`,
        [{ field: 'id', message: 'Reassign or remove those items first' }],
      );
    }

    itemTypes.remove(tx, id);
    return { id, deleted: true };
  });
}
