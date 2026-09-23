import { nextId, nowIso } from '../store.js';
import { matchesAvailability } from '../../utils/stock.js';

/**
 * items data access, including the item -> item_type join required by the
 * assignment (section 12).
 */

/** Emulates the `stock_available >= 0` CHECK constraint. */
function assertNonNegative(stock) {
  if (!Number.isInteger(stock) || stock < 0) {
    // Defence in depth: services validate first, this guarantees the invariant.
    throw new Error(`Stock integrity violation: refusing to persist stock of ${stock}`);
  }
}

/** Joins one item row to its type. */
function withType(db, item) {
  if (!item) return null;
  const type = db.itemTypes.find((row) => row.id === item.itemTypeId) ?? null;
  return {
    ...item,
    itemTypeName: type?.typeName ?? null,
  };
}

/**
 * MANDATORY JOIN #1 (assignment section 12):
 *
 *   SELECT i.id, i.name, it.type_name, i.purchase_date, i.stock_available, i.active
 *   FROM items i
 *   JOIN item_types it ON i.item_type_id = it.id
 *   ORDER BY i.id;
 *
 * Optional filters: search term, item type, active flag, availability bucket.
 */
export function findAllWithType(db, { q, itemTypeId, active, availability } = {}) {
  const needle = q?.trim().toLowerCase();

  return db.items
    .filter((item) => {
      if (itemTypeId !== undefined && item.itemTypeId !== itemTypeId) return false;
      if (active !== undefined && item.active !== active) return false;
      if (!matchesAvailability(item.stockAvailable, availability)) return false;
      if (needle) {
        const type = db.itemTypes.find((row) => row.id === item.itemTypeId);
        const haystack = `${item.name} ${type?.typeName ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .map((item) => withType(db, item))
    .sort((a, b) => a.id - b.id);
}

/**
 * SELECT i.*, it.type_name FROM items i
 * JOIN item_types it ON i.item_type_id = it.id WHERE i.id = ?
 */
export function findByIdWithType(db, id) {
  return withType(db, db.items.find((item) => item.id === id) ?? null);
}

/** SELECT * FROM items WHERE id = ? */
export function findById(db, id) {
  return db.items.find((item) => item.id === id) ?? null;
}

/** SELECT * FROM items WHERE id IN (?) */
export function findManyByIds(db, ids) {
  const wanted = new Set(ids);
  return db.items.filter((item) => wanted.has(item.id));
}

/** SELECT * FROM items WHERE LOWER(name) = LOWER(?) */
export function findByName(db, name, { excludeId = null } = {}) {
  const needle = name.trim().toLowerCase();
  return (
    db.items.find((item) => item.name.toLowerCase() === needle && item.id !== excludeId) ?? null
  );
}

/**
 * INSERT INTO items (name, item_type_id, purchase_date, stock_available, active)
 * VALUES (?, ?, ?, ?, ?)
 */
export function insert(db, { name, itemTypeId, purchaseDate, stockAvailable, active }) {
  assertNonNegative(stockAvailable);
  const timestamp = nowIso();
  const row = {
    id: nextId('items'),
    name,
    itemTypeId,
    purchaseDate,
    stockAvailable,
    active,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  db.items.push(row);
  return row;
}

/** UPDATE items SET ... WHERE id = ? */
export function update(db, id, patch) {
  const row = findById(db, id);
  if (!row) return null;
  if (patch.stockAvailable !== undefined) assertNonNegative(patch.stockAvailable);

  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) row[key] = value;
  }
  row.updatedAt = nowIso();
  return row;
}

/**
 * UPDATE items SET stock_available = stock_available - ? WHERE id = ? AND stock_available >= ?
 *
 * `delta` is the amount consumed: positive deducts stock, negative returns it.
 * Returns the updated row. Throws if the result would be negative, which is the
 * last line of defence behind the service level validation.
 */
export function applyStockDelta(db, id, delta) {
  const row = findById(db, id);
  if (!row) return null;
  const next = row.stockAvailable - delta;
  assertNonNegative(next);
  row.stockAvailable = next;
  row.updatedAt = nowIso();
  return row;
}

/** DELETE FROM items WHERE id = ? */
export function remove(db, id) {
  const index = db.items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  db.items.splice(index, 1);
  return true;
}

/** SELECT COUNT(*) FROM purchase_items WHERE item_id = ? */
export function countPurchaseLines(db, itemId) {
  return db.purchaseItems.filter((line) => line.itemId === itemId).length;
}

/**
 * Purchase history summary for the item details screen.
 *
 *   SELECT p.id, p.order_id, p.purchase_date, pi.quantity
 *   FROM purchase_items pi
 *   JOIN purchases p ON pi.purchase_id = p.id
 *   WHERE pi.item_id = ?
 *   ORDER BY p.purchase_date DESC, p.id DESC;
 */
export function findPurchaseHistory(db, itemId) {
  return db.purchaseItems
    .filter((line) => line.itemId === itemId)
    .map((line) => {
      const purchase = db.purchases.find((row) => row.id === line.purchaseId);
      return {
        purchaseId: line.purchaseId,
        orderId: purchase?.orderId ?? null,
        purchaseDate: purchase?.purchaseDate ?? null,
        quantity: line.quantity,
      };
    })
    .sort((a, b) => b.purchaseDate?.localeCompare(a.purchaseDate) || b.purchaseId - a.purchaseId);
}
