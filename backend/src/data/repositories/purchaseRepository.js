import { nextId, nowIso } from '../store.js';

/**
 * purchases + purchase_items data access, including the four table join required
 * by the assignment (section 12).
 *
 * Note there is deliberately **no delete function** in this repository:
 * purchases are historical records (assignment section 8).
 */

const ORDER_ID_PREFIX = 'PO-';
const ORDER_ID_PAD = 5;

/** Formats a sequence number as `PO-00001`. */
export const formatOrderId = (sequence) =>
  `${ORDER_ID_PREFIX}${String(sequence).padStart(ORDER_ID_PAD, '0')}`;

/**
 * Next free order id, derived from the highest existing `PO-#####`.
 *
 * SQL equivalent:
 *   SELECT order_id FROM purchases
 *   WHERE order_id REGEXP '^PO-[0-9]+$'
 *   ORDER BY CAST(SUBSTRING(order_id, 4) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE;
 */
export function nextOrderId(db) {
  const highest = db.purchases.reduce((max, purchase) => {
    const match = /^PO-(\d+)$/.exec(purchase.orderId);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);
  return formatOrderId(highest + 1);
}

/** SELECT * FROM purchases WHERE id = ? */
export function findById(db, id) {
  return db.purchases.find((row) => row.id === id) ?? null;
}

/** SELECT * FROM purchases WHERE order_id = ? */
export function findByOrderId(db, orderId, { excludeId = null } = {}) {
  const needle = orderId.trim().toLowerCase();
  return (
    db.purchases.find(
      (row) => row.orderId.toLowerCase() === needle && row.id !== excludeId,
    ) ?? null
  );
}

/**
 * Purchase list with aggregates.
 *
 *   SELECT p.id, p.order_id, p.purchase_date,
 *          COUNT(pi.id) AS line_count, COALESCE(SUM(pi.quantity), 0) AS total_quantity
 *   FROM purchases p
 *   LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
 *   GROUP BY p.id
 *   ORDER BY p.purchase_date DESC, p.id DESC;
 */
export function findAllWithSummary(db, { q, from, to } = {}) {
  const needle = q?.trim().toLowerCase();

  return db.purchases
    .filter((purchase) => {
      if (needle && !purchase.orderId.toLowerCase().includes(needle)) return false;
      if (from && purchase.purchaseDate < from) return false;
      if (to && purchase.purchaseDate > to) return false;
      return true;
    })
    .map((purchase) => {
      const lines = db.purchaseItems.filter((line) => line.purchaseId === purchase.id);
      return {
        ...purchase,
        lineCount: lines.length,
        totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      };
    })
    .sort(
      (a, b) => b.purchaseDate.localeCompare(a.purchaseDate) || b.id - a.id,
    );
}

/** SELECT * FROM purchase_items WHERE purchase_id = ? */
export function findLines(db, purchaseId) {
  return db.purchaseItems
    .filter((line) => line.purchaseId === purchaseId)
    .sort((a, b) => a.id - b.id);
}

/**
 * MANDATORY JOIN #2 (assignment section 12):
 *
 *   SELECT p.order_id, p.purchase_date, i.id AS item_id, i.name AS item_name,
 *          it.type_name, pi.quantity
 *   FROM purchases p
 *   JOIN purchase_items pi ON p.id = pi.purchase_id
 *   JOIN items i          ON pi.item_id = i.id
 *   JOIN item_types it    ON i.item_type_id = it.id
 *   WHERE p.id = ?;
 *
 * Inactive items still resolve here, so historical purchases stay readable
 * (assignment section 9).
 */
export function findDetailLines(db, purchaseId) {
  return findLines(db, purchaseId).map((line) => {
    const item = db.items.find((row) => row.id === line.itemId) ?? null;
    const type = item ? db.itemTypes.find((row) => row.id === item.itemTypeId) ?? null : null;

    return {
      purchaseItemId: line.id,
      itemId: line.itemId,
      itemName: item?.name ?? '(item removed)',
      itemTypeId: item?.itemTypeId ?? null,
      itemTypeName: type?.typeName ?? null,
      itemActive: item?.active ?? false,
      quantity: line.quantity,
      currentStock: item?.stockAvailable ?? 0,
    };
  });
}

/** INSERT INTO purchases (order_id, purchase_date) VALUES (?, ?) */
export function insertPurchase(db, { orderId, purchaseDate }) {
  const timestamp = nowIso();
  const row = {
    id: nextId('purchases'),
    orderId,
    purchaseDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.purchases.push(row);
  return row;
}

/** UPDATE purchases SET purchase_date = ? WHERE id = ? */
export function updatePurchase(db, id, patch) {
  const row = findById(db, id);
  if (!row) return null;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) row[key] = value;
  }
  row.updatedAt = nowIso();
  return row;
}

/** INSERT INTO purchase_items (purchase_id, item_id, quantity) VALUES (?, ?, ?) */
export function insertLine(db, { purchaseId, itemId, quantity }) {
  const row = {
    id: nextId('purchaseItems'),
    purchaseId,
    itemId,
    quantity,
    createdAt: nowIso(),
  };
  db.purchaseItems.push(row);
  return row;
}

/** UPDATE purchase_items SET quantity = ? WHERE id = ? */
export function updateLineQuantity(db, lineId, quantity) {
  const row = db.purchaseItems.find((line) => line.id === lineId);
  if (!row) return null;
  row.quantity = quantity;
  return row;
}

/**
 * DELETE FROM purchase_items WHERE id = ?
 *
 * Removes a *line* from an existing order (allowed, with the stock returned by
 * the service). The purchase itself is never deleted.
 */
export function removeLine(db, lineId) {
  const index = db.purchaseItems.findIndex((line) => line.id === lineId);
  if (index === -1) return false;
  db.purchaseItems.splice(index, 1);
  return true;
}
