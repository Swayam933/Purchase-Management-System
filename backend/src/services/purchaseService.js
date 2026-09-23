import { db, transaction } from '../data/store.js';
import * as purchases from '../data/repositories/purchaseRepository.js';
import * as items from '../data/repositories/itemRepository.js';
import { conflict, notFound } from '../utils/AppError.js';
import { toPurchaseLineDto, toPurchaseSummaryDto } from './mappers.js';

/* ------------------------------------------------------------------ *
 * Read side
 * ------------------------------------------------------------------ */

/** Builds the purchase detail payload from the four table join. */
function buildDetail(handle, purchaseId) {
  const purchase = purchases.findById(handle, purchaseId);
  if (!purchase) throw notFound('Purchase not found');

  const lines = purchases.findDetailLines(handle, purchaseId).map(toPurchaseLineDto);

  return {
    id: purchase.id,
    orderId: purchase.orderId,
    purchaseDate: purchase.purchaseDate,
    lineCount: lines.length,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    items: lines,
    createdAt: purchase.createdAt,
    updatedAt: purchase.updatedAt,
  };
}

export function list(filters = {}) {
  return purchases.findAllWithSummary(db, filters).map(toPurchaseSummaryDto);
}

export function getById(id) {
  return buildDetail(db, id);
}

/** Lets the create-purchase screen show the order id that will be assigned. */
export function peekNextOrderId() {
  return purchases.nextOrderId(db);
}

/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */

function resolveItem(handle, itemId, path) {
  const item = items.findById(handle, itemId);
  if (!item) {
    throw notFound(`Item not found: no item with id ${itemId}`);
  }
  return { item, path };
}

function assertPurchasable(item, path) {
  if (!item.active) {
    throw conflict(`Item is inactive and cannot be purchased: "${item.name}"`, [
      { field: `${path}.itemId`, message: 'This item is inactive' },
    ]);
  }
}

/**
 * Guarantees stock can absorb `required` additional units.
 * `previousQuantity` is 0 on create and the existing line quantity on update.
 */
function assertSufficientStock(item, required, previousQuantity, path) {
  if (required <= item.stockAvailable) return;

  const message =
    previousQuantity > 0
      ? `Insufficient stock for "${item.name}". Increasing from ${previousQuantity} to ${previousQuantity + required} needs ${required} more unit(s), only ${item.stockAvailable} available.`
      : `Insufficient stock for "${item.name}". Requested ${required}, available ${item.stockAvailable}.`;

  throw conflict(message, [
    {
      field: `${path}.quantity`,
      message: `Only ${item.stockAvailable} unit(s) available`,
      available: item.stockAvailable,
    },
  ]);
}

/* ------------------------------------------------------------------ *
 * Write side
 * ------------------------------------------------------------------ */

/**
 * Creates a purchase atomically (assignment sections 6 and 13):
 *
 *   BEGIN
 *     validate every item (exists, active, enough stock)
 *     INSERT purchases
 *     INSERT purchase_items
 *     UPDATE items.stock_available
 *   COMMIT           (ROLLBACK on any failure)
 *
 * Nothing is written until every line has passed validation, so a rejected
 * purchase leaves stock completely untouched.
 */
export async function create({ orderId, purchaseDate, items: lines }) {
  return transaction((tx) => {
    const finalOrderId = orderId ?? purchases.nextOrderId(tx);

    if (purchases.findByOrderId(tx, finalOrderId)) {
      throw conflict(`Order ID "${finalOrderId}" already exists`, [
        { field: 'orderId', message: 'This Order ID is already used' },
      ]);
    }

    // --- validate everything first -------------------------------------
    const plan = lines.map((line, index) => {
      const path = `items[${index}]`;
      const { item } = resolveItem(tx, line.itemId, path);
      assertPurchasable(item, path);
      assertSufficientStock(item, line.quantity, 0, path);
      return { itemId: line.itemId, quantity: line.quantity };
    });

    // --- then write ----------------------------------------------------
    const purchase = purchases.insertPurchase(tx, { orderId: finalOrderId, purchaseDate });

    for (const line of plan) {
      purchases.insertLine(tx, {
        purchaseId: purchase.id,
        itemId: line.itemId,
        quantity: line.quantity,
      });
      // Positive delta = units leaving stock.
      items.applyStockDelta(tx, line.itemId, line.quantity);
    }

    return buildDetail(tx, purchase.id);
  });
}

/**
 * Updates a purchase and reconciles stock by the *difference* between the old
 * and new quantities (assignment section 7):
 *
 *   3 -> 5 : deduct 2 more
 *   5 -> 2 : return 3 to stock
 *   line removed : return the whole quantity
 *   line added   : behaves like a new purchase line
 *
 * The purchase itself is never deleted, only its lines can change.
 */
export async function update(id, { purchaseDate, items: lines }) {
  return transaction((tx) => {
    const purchase = purchases.findById(tx, id);
    if (!purchase) throw notFound('Purchase not found');

    if (lines !== undefined) {
      const existingLines = purchases.findLines(tx, id);
      const existingByItemId = new Map(existingLines.map((line) => [line.itemId, line]));

      // --- validate every change first ---------------------------------
      const plan = lines.map((line, index) => {
        const path = `items[${index}]`;
        const { item } = resolveItem(tx, line.itemId, path);
        const existing = existingByItemId.get(line.itemId);
        const previousQuantity = existing?.quantity ?? 0;
        const delta = line.quantity - previousQuantity;

        // An inactive item may stay on the order or be reduced/removed, but its
        // quantity can never grow and it can never be newly added.
        if (delta > 0) assertPurchasable(item, path);
        if (delta > 0) assertSufficientStock(item, delta, previousQuantity, path);

        return { itemId: line.itemId, quantity: line.quantity, delta, existingLineId: existing?.id };
      });

      const keptItemIds = new Set(lines.map((line) => line.itemId));
      const removedLines = existingLines.filter((line) => !keptItemIds.has(line.itemId));

      // --- then write --------------------------------------------------
      // Return stock for removed lines.
      for (const line of removedLines) {
        items.applyStockDelta(tx, line.itemId, -line.quantity);
        purchases.removeLine(tx, line.id);
      }

      // Apply the per-item delta for kept / added lines.
      for (const line of plan) {
        if (line.existingLineId) {
          purchases.updateLineQuantity(tx, line.existingLineId, line.quantity);
        } else {
          purchases.insertLine(tx, {
            purchaseId: id,
            itemId: line.itemId,
            quantity: line.quantity,
          });
        }
        if (line.delta !== 0) items.applyStockDelta(tx, line.itemId, line.delta);
      }
    }

    if (purchaseDate !== undefined) {
      purchases.updatePurchase(tx, id, { purchaseDate });
    } else if (lines !== undefined) {
      purchases.updatePurchase(tx, id, {});
    }

    return buildDetail(tx, id);
  });
}

/*
 * There is intentionally no `remove()` here.
 *
 * Purchases are historical transactions (assignment section 8): the API exposes
 * no DELETE endpoint and the service layer offers no deletion path, so the rule
 * cannot be bypassed from a controller.
 */
