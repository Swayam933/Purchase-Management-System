import { pool, transaction } from '../data/mysql.js';
import * as purchases from '../data/repositories/purchaseRepository.js';
import * as items from '../data/repositories/itemRepository.js';
import { conflict, notFound } from '../utils/AppError.js';
import { toPurchaseLineDto, toPurchaseSummaryDto } from './mappers.js';

async function buildDetail(handle, purchaseId) {
  const purchase = await purchases.findById(handle, purchaseId);
  if (!purchase) throw notFound('Purchase not found');
  const lines = (await purchases.findDetailLines(handle, purchaseId)).map(toPurchaseLineDto);
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

export async function list(filters = {}) {
  return (await purchases.findAllWithSummary(pool, filters)).map(toPurchaseSummaryDto);
}

export async function getById(id) {
  return buildDetail(pool, id);
}

export async function peekNextOrderId() {
  return purchases.nextOrderId(pool);
}

function assertPurchasable(item, path) {
  if (!item.active) {
    throw conflict(`Item is inactive and cannot be purchased: "${item.name}"`, [
      { field: `${path}.itemId`, message: 'This item is inactive' },
    ]);
  }
}

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

export async function create({ orderId, purchaseDate, items: lines }) {
  return transaction(async (tx) => {
    const finalOrderId = orderId ?? await purchases.reserveNextOrderId(tx);
    if (await purchases.findByOrderId(tx, finalOrderId)) {
      throw conflict(`Order ID "${finalOrderId}" already exists`, [
        { field: 'orderId', message: 'This Order ID is already used' },
      ]);
    }

    const lockedItems = await items.findManyByIds(
      tx,
      [...new Set(lines.map((line) => line.itemId))].sort((a, b) => a - b),
      { forUpdate: true },
    );
    const byId = new Map(lockedItems.map((item) => [item.id, item]));
    const plan = lines.map((line, index) => {
      const path = `items[${index}]`;
      const item = byId.get(line.itemId);
      if (!item) throw notFound(`Item not found: no item with id ${line.itemId}`);
      assertPurchasable(item, path);
      assertSufficientStock(item, line.quantity, 0, path);
      return { itemId: line.itemId, quantity: line.quantity };
    });

    const purchase = await purchases.insertPurchase(tx, {
      orderId: finalOrderId,
      purchaseDate,
    });
    for (const line of plan) {
      await purchases.insertLine(tx, {
        purchaseId: purchase.id,
        itemId: line.itemId,
        quantity: line.quantity,
      });
      await items.applyStockDelta(tx, line.itemId, line.quantity);
    }
    return buildDetail(tx, purchase.id);
  });
}

export async function update(id, { purchaseDate, items: lines }) {
  return transaction(async (tx) => {
    const purchase = await purchases.findById(tx, id, { forUpdate: true });
    if (!purchase) throw notFound('Purchase not found');

    if (lines !== undefined) {
      const existingLines = await purchases.findLines(tx, id, { forUpdate: true });
      const existingByItemId = new Map(existingLines.map((line) => [line.itemId, line]));
      const idsToLock = [
        ...new Set([
          ...existingLines.map((line) => line.itemId),
          ...lines.map((line) => line.itemId),
        ]),
      ].sort((a, b) => a - b);
      const lockedItems = await items.findManyByIds(tx, idsToLock, { forUpdate: true });
      const byId = new Map(lockedItems.map((item) => [item.id, item]));

      const plan = lines.map((line, index) => {
        const path = `items[${index}]`;
        const item = byId.get(line.itemId);
        if (!item) throw notFound(`Item not found: no item with id ${line.itemId}`);
        const existing = existingByItemId.get(line.itemId);
        const previousQuantity = existing?.quantity ?? 0;
        const delta = line.quantity - previousQuantity;
        if (delta > 0) {
          assertPurchasable(item, path);
          assertSufficientStock(item, delta, previousQuantity, path);
        }
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          delta,
          existingLineId: existing?.id,
        };
      });

      const keptIds = new Set(lines.map((line) => line.itemId));
      const removedLines = existingLines.filter((line) => !keptIds.has(line.itemId));
      for (const line of removedLines) {
        await items.applyStockDelta(tx, line.itemId, -line.quantity);
        await purchases.removeLine(tx, line.id);
      }

      for (const line of plan) {
        if (line.existingLineId) {
          await purchases.updateLineQuantity(tx, line.existingLineId, line.quantity);
        } else {
          await purchases.insertLine(tx, {
            purchaseId: id,
            itemId: line.itemId,
            quantity: line.quantity,
          });
        }
        if (line.delta !== 0) await items.applyStockDelta(tx, line.itemId, line.delta);
      }
    }

    if (purchaseDate !== undefined || lines !== undefined) {
      await purchases.updatePurchase(tx, id, { purchaseDate });
    }
    return buildDetail(tx, id);
  });
}
