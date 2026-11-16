import { query } from '../mysql.js';
import { config } from '../../config/env.js';
import { AVAILABILITY } from '../../utils/stock.js';

const ITEM_COLUMNS = `i.id, i.name, i.item_type_id AS itemTypeId,
  i.purchase_date AS purchaseDate, i.stock_available AS stockAvailable,
  i.active AS active, i.created_at AS createdAt, i.updated_at AS updatedAt`;

const ITEM_WITH_TYPE = `SELECT ${ITEM_COLUMNS}, it.type_name AS itemTypeName
  FROM items i JOIN item_types it ON i.item_type_id = it.id`;

const ITEM_BY_ID = `SELECT id, name, item_type_id AS itemTypeId,
  purchase_date AS purchaseDate, stock_available AS stockAvailable,
  active, created_at AS createdAt, updated_at AS updatedAt FROM items`;

function buildFilters(filters = {}) {
  const clauses = [];
  const parameters = [];

  if (filters.itemTypeId !== undefined) {
    clauses.push('i.item_type_id = ?');
    parameters.push(filters.itemTypeId);
  }
  if (filters.active !== undefined) {
    clauses.push('i.active = ?');
    parameters.push(filters.active ? 1 : 0);
  }
  if (filters.q) {
    clauses.push('(LOWER(i.name) LIKE ? OR LOWER(it.type_name) LIKE ?)');
    const needle = `%${filters.q.trim().toLowerCase()}%`;
    parameters.push(needle, needle);
  }
  if (filters.availability === AVAILABILITY.OUT_OF_STOCK) {
    clauses.push('i.stock_available = 0');
  } else if (filters.availability === AVAILABILITY.LOW_STOCK) {
    if (config.lowStockThreshold <= 0) clauses.push('1 = 0');
    else {
      clauses.push('i.stock_available > 0 AND i.stock_available <= ?');
      parameters.push(config.lowStockThreshold);
    }
  } else if (filters.availability === AVAILABILITY.IN_STOCK) {
    clauses.push('i.stock_available > 0');
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    parameters,
  };
}

export async function findAllWithType(db, filters) {
  const { where, parameters } = buildFilters(filters);
  return query(db, `${ITEM_WITH_TYPE} ${where} ORDER BY i.id`, parameters);
}

export async function findByIdWithType(db, id) {
  const rows = await query(db, `${ITEM_WITH_TYPE} WHERE i.id = ?`, [id]);
  return rows[0] ?? null;
}

export async function findById(db, id, { forUpdate = false } = {}) {
  const rows = await query(db, `${ITEM_BY_ID} WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`, [id]);
  return rows[0] ?? null;
}

export async function findManyByIds(db, ids, { forUpdate = false } = {}) {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return query(
    db,
    `${ITEM_BY_ID} WHERE id IN (${placeholders}) ORDER BY id${forUpdate ? ' FOR UPDATE' : ''}`,
    ids,
  );
}

export async function findByName(db, name, { excludeId = null } = {}) {
  const rows = await query(
    db,
    `SELECT id FROM items
     WHERE LOWER(name) = LOWER(?) AND (? IS NULL OR id <> ?) LIMIT 1`,
    [name.trim(), excludeId, excludeId],
  );
  return rows[0] ?? null;
}

export async function insert(db, { name, itemTypeId, purchaseDate, stockAvailable, active }) {
  const result = await query(
    db,
    `INSERT INTO items
      (name, item_type_id, purchase_date, stock_available, active)
     VALUES (?, ?, ?, ?, ?)`,
    [name, itemTypeId, purchaseDate, stockAvailable, active ? 1 : 0],
  );
  return findById(db, result.insertId);
}

export async function update(db, id, patch) {
  const columns = {
    name: 'name',
    itemTypeId: 'item_type_id',
    purchaseDate: 'purchase_date',
    stockAvailable: 'stock_available',
    active: 'active',
  };
  const assignments = [];
  const parameters = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] === undefined) continue;
    assignments.push(`${column} = ?`);
    parameters.push(key === 'active' ? (patch[key] ? 1 : 0) : patch[key]);
  }
  if (assignments.length) {
    await query(db, `UPDATE items SET ${assignments.join(', ')} WHERE id = ?`, [...parameters, id]);
  }
  return findById(db, id);
}

export async function applyStockDelta(db, id, delta) {
  const result = await query(
    db,
    `UPDATE items
     SET stock_available = stock_available - ?
     WHERE id = ? AND stock_available - ? >= 0`,
    [delta, id, delta],
  );
  if (result.affectedRows !== 1) {
    throw new Error(`Stock update failed for item ${id}`);
  }
  return findById(db, id);
}

export async function remove(db, id) {
  const result = await query(db, 'DELETE FROM items WHERE id = ?', [id]);
  return result.affectedRows === 1;
}

export async function countPurchaseLines(db, itemId) {
  const [row] = await query(
    db,
    'SELECT COUNT(*) AS count FROM purchase_items WHERE item_id = ?',
    [itemId],
  );
  return Number(row.count);
}

export async function findPurchaseHistory(db, itemId) {
  return query(
    db,
    `SELECT p.id AS purchaseId, p.order_id AS orderId,
            p.purchase_date AS purchaseDate, pi.quantity
     FROM purchase_items pi
     JOIN purchases p ON pi.purchase_id = p.id
     WHERE pi.item_id = ?
     ORDER BY p.purchase_date DESC, p.id DESC`,
    [itemId],
  );
}
