import { availabilityFor } from '../utils/stock.js';

/** Shapes an item (already joined to its type) for API responses. */
export const toItemDto = (row) => ({
  id: row.id,
  name: row.name,
  itemTypeId: row.itemTypeId,
  itemTypeName: row.itemTypeName ?? null,
  purchaseDate: row.purchaseDate,
  stockAvailable: row.stockAvailable,
  availability: availabilityFor(row.stockAvailable),
  active: Boolean(row.active),
  status: row.active ? 'Active' : 'Inactive',
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toItemTypeDto = (row) => ({
  id: row.id,
  typeName: row.typeName,
  ...(row.itemCount !== undefined ? { itemCount: Number(row.itemCount) } : {}),
  ...(row.activeItemCount !== undefined ? { activeItemCount: Number(row.activeItemCount) } : {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toPurchaseSummaryDto = (row) => ({
  id: row.id,
  orderId: row.orderId,
  purchaseDate: row.purchaseDate,
  lineCount: Number(row.lineCount),
  totalQuantity: Number(row.totalQuantity),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const toPurchaseLineDto = (line) => ({
  purchaseItemId: line.purchaseItemId,
  itemId: line.itemId,
  itemName: line.itemName,
  itemTypeId: line.itemTypeId,
  itemTypeName: line.itemTypeName,
  itemActive: Boolean(line.itemActive),
  quantity: Number(line.quantity),
  currentStock: Number(line.currentStock),
  availability: availabilityFor(line.currentStock),
});
