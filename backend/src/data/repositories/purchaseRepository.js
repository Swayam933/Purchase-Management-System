import { query } from '../mysql.js';

const ORDER_ID_PREFIX = 'PO-';
const ORDER_ID_PAD = 5;

export const formatOrderId = (sequence) =>
  `${ORDER_ID_PREFIX}${String(sequence).padStart(ORDER_ID_PAD, '0')}`;

async function unusedSequence(db, sequence) {
  let candidate = sequence;
  for (;;) {
    const orderId = formatOrderId(candidate);
    const rows = await query(db, 'SELECT id FROM purchases WHERE order_id = ? LIMIT 1', [orderId]);
    if (rows.length === 0) return { orderId, sequence: candidate };
    candidate += 1;
  }
}

export async function nextOrderId(db) {
  const [row] = await query(
    db,
    'SELECT next_value AS nextValue FROM purchase_order_sequence WHERE id = 1',
  );
  const next = await unusedSequence(db, Number(row.nextValue));
  return next.orderId;
}

export async function reserveNextOrderId(db) {
  const [row] = await query(
    db,
    'SELECT next_value AS nextValue FROM purchase_order_sequence WHERE id = 1 FOR UPDATE',
  );
  const next = await unusedSequence(db, Number(row.nextValue));
  await query(
    db,
    'UPDATE purchase_order_sequence SET next_value = ? WHERE id = 1',
    [next.sequence + 1],
  );
  return next.orderId;
}

export async function findById(db, id, { forUpdate = false } = {}) {
  const rows = await query(
    db,
    `SELECT id, order_id AS orderId, purchase_date AS purchaseDate,
            created_at AS createdAt, updated_at AS updatedAt
     FROM purchases WHERE id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function findByOrderId(db, orderId, { excludeId = null } = {}) {
  const rows = await query(
    db,
    `SELECT id FROM purchases
     WHERE LOWER(order_id) = LOWER(?) AND (? IS NULL OR id <> ?) LIMIT 1`,
    [orderId.trim(), excludeId, excludeId],
  );
  return rows[0] ?? null;
}

export async function findAllWithSummary(db, { q, from, to } = {}) {
  const clauses = [];
  const parameters = [];
  if (q) {
    clauses.push('LOWER(p.order_id) LIKE ?');
    parameters.push(`%${q.trim().toLowerCase()}%`);
  }
  if (from) {
    clauses.push('p.purchase_date >= ?');
    parameters.push(from);
  }
  if (to) {
    clauses.push('p.purchase_date <= ?');
    parameters.push(to);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return query(
    db,
    `SELECT p.id, p.order_id AS orderId, p.purchase_date AS purchaseDate,
            COUNT(pi.id) AS lineCount,
            COALESCE(SUM(pi.quantity), 0) AS totalQuantity,
            p.created_at AS createdAt, p.updated_at AS updatedAt
     FROM purchases p
     LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
     ${where}
     GROUP BY p.id, p.order_id, p.purchase_date, p.created_at, p.updated_at
     ORDER BY p.purchase_date DESC, p.id DESC`,
    parameters,
  );
}

export async function findLines(db, purchaseId, { forUpdate = false } = {}) {
  return query(
    db,
    `SELECT id, purchase_id AS purchaseId, item_id AS itemId,
            quantity, created_at AS createdAt
     FROM purchase_items WHERE purchase_id = ? ORDER BY id${forUpdate ? ' FOR UPDATE' : ''}`,
    [purchaseId],
  );
}

export async function findDetailLines(db, purchaseId) {
  return query(
    db,
    `SELECT pi.id AS purchaseItemId, i.id AS itemId, i.name AS itemName,
            i.item_type_id AS itemTypeId, it.type_name AS itemTypeName,
            i.active AS itemActive, pi.quantity,
            i.stock_available AS currentStock
     FROM purchases p
     JOIN purchase_items pi ON p.id = pi.purchase_id
     JOIN items i ON pi.item_id = i.id
     JOIN item_types it ON i.item_type_id = it.id
     WHERE p.id = ?
     ORDER BY pi.id`,
    [purchaseId],
  );
}

export async function insertPurchase(db, { orderId, purchaseDate }) {
  const result = await query(
    db,
    'INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?)',
    [orderId, purchaseDate],
  );
  return findById(db, result.insertId);
}

export async function updatePurchase(db, id, patch) {
  if (patch.purchaseDate !== undefined) {
    await query(
      db,
      'UPDATE purchases SET purchase_date = ? WHERE id = ?',
      [patch.purchaseDate, id],
    );
  } else {
    await query(db, 'UPDATE purchases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }
  return findById(db, id);
}

export async function insertLine(db, { purchaseId, itemId, quantity }) {
  const result = await query(
    db,
    'INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?)',
    [purchaseId, itemId, quantity],
  );
  return { id: result.insertId, purchaseId, itemId, quantity };
}

export async function updateLineQuantity(db, lineId, quantity) {
  await query(db, 'UPDATE purchase_items SET quantity = ? WHERE id = ?', [quantity, lineId]);
}

export async function removeLine(db, lineId) {
  const result = await query(db, 'DELETE FROM purchase_items WHERE id = ?', [lineId]);
  return result.affectedRows === 1;
}
