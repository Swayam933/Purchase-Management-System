import { query } from '../mysql.js';

export async function findAll(db) {
  return query(
    db,
    `SELECT id, type_name AS typeName, created_at AS createdAt, updated_at AS updatedAt
     FROM item_types ORDER BY type_name`,
  );
}

export async function findById(db, id) {
  const rows = await query(
    db,
    `SELECT id, type_name AS typeName, created_at AS createdAt, updated_at AS updatedAt
     FROM item_types WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findByName(db, typeName, { excludeId = null } = {}) {
  const rows = await query(
    db,
    `SELECT id FROM item_types
     WHERE LOWER(type_name) = LOWER(?) AND (? IS NULL OR id <> ?) LIMIT 1`,
    [typeName.trim(), excludeId, excludeId],
  );
  return rows[0] ?? null;
}

export async function insert(db, { typeName }) {
  const result = await query(db, 'INSERT INTO item_types (type_name) VALUES (?)', [typeName]);
  return findById(db, result.insertId);
}

export async function update(db, id, { typeName }) {
  await query(db, 'UPDATE item_types SET type_name = ? WHERE id = ?', [typeName, id]);
  return findById(db, id);
}

export async function remove(db, id) {
  const result = await query(db, 'DELETE FROM item_types WHERE id = ?', [id]);
  return result.affectedRows === 1;
}

export async function countItems(db, itemTypeId) {
  const [row] = await query(
    db,
    'SELECT COUNT(*) AS count FROM items WHERE item_type_id = ?',
    [itemTypeId],
  );
  return Number(row.count);
}

export async function findAllWithItemCounts(db) {
  return query(
    db,
    `SELECT it.id, it.type_name AS typeName,
            COUNT(i.id) AS itemCount,
            COALESCE(SUM(i.active = 1), 0) AS activeItemCount,
            it.created_at AS createdAt, it.updated_at AS updatedAt
     FROM item_types it
     LEFT JOIN items i ON i.item_type_id = it.id
     GROUP BY it.id, it.type_name, it.created_at, it.updated_at
     ORDER BY it.type_name`,
  );
}
