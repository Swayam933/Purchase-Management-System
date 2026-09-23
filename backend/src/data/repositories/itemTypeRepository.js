import { nextId, nowIso } from '../store.js';

/**
 * item_types data access.
 *
 * Every function takes the table handle (`db`) as its first argument, the same
 * way a MySQL implementation would take a connection or pool. Swapping this
 * file for `mysql2` queries requires no changes elsewhere.
 */

const byName = (a, b) => a.typeName.localeCompare(b.typeName);

/** SELECT * FROM item_types ORDER BY type_name */
export function findAll(db) {
  return [...db.itemTypes].sort(byName);
}

/** SELECT * FROM item_types WHERE id = ? */
export function findById(db, id) {
  return db.itemTypes.find((row) => row.id === id) ?? null;
}

/** SELECT * FROM item_types WHERE LOWER(type_name) = LOWER(?) */
export function findByName(db, typeName, { excludeId = null } = {}) {
  const needle = typeName.trim().toLowerCase();
  return (
    db.itemTypes.find(
      (row) => row.typeName.toLowerCase() === needle && row.id !== excludeId,
    ) ?? null
  );
}

/** INSERT INTO item_types (type_name) VALUES (?) */
export function insert(db, { typeName }) {
  const timestamp = nowIso();
  const row = {
    id: nextId('itemTypes'),
    typeName,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.itemTypes.push(row);
  return row;
}

/** UPDATE item_types SET type_name = ? WHERE id = ? */
export function update(db, id, { typeName }) {
  const row = findById(db, id);
  if (!row) return null;
  row.typeName = typeName;
  row.updatedAt = nowIso();
  return row;
}

/** DELETE FROM item_types WHERE id = ? */
export function remove(db, id) {
  const index = db.itemTypes.findIndex((row) => row.id === id);
  if (index === -1) return false;
  db.itemTypes.splice(index, 1);
  return true;
}

/** SELECT COUNT(*) FROM items WHERE item_type_id = ? */
export function countItems(db, itemTypeId) {
  return db.items.filter((item) => item.itemTypeId === itemTypeId).length;
}

/**
 * SELECT it.id, it.type_name, COUNT(i.id) AS item_count
 * FROM item_types it LEFT JOIN items i ON i.item_type_id = it.id
 * GROUP BY it.id ORDER BY it.type_name
 */
export function findAllWithItemCounts(db) {
  return findAll(db).map((type) => ({
    ...type,
    itemCount: countItems(db, type.id),
    activeItemCount: db.items.filter((item) => item.itemTypeId === type.id && item.active).length,
  }));
}
