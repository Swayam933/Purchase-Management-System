import { tables, nextId, nowIso, reset, stats } from './store.js';

/**
 * Demo dataset.
 *
 * Item types come from assignment section 2 and the first three items reproduce
 * the "Initial Item Master" of section 17 exactly (Laptop 10, Mouse 20,
 * Chair 15) so the end-to-end example can be replayed as-is: create PO-00001
 * with Laptop 2 / Mouse 5 / Chair 3 and the stock lands on 8 / 15 / 12.
 *
 * No purchases are seeded, keeping the purchase history authentic to whatever
 * you do in the UI.
 */

const ITEM_TYPES = ['Electronics', 'Furniture', 'Clothing', 'Grocery', 'Stationery'];

const ITEMS = [
  // Section 17 "Initial Item Master"
  { name: 'Laptop', type: 'Electronics', purchaseDate: '2026-08-25', stock: 10, active: true },
  { name: 'Mouse', type: 'Electronics', purchaseDate: '2026-08-25', stock: 20, active: true },
  { name: 'Chair', type: 'Furniture', purchaseDate: '2026-08-20', stock: 15, active: true },
  // Extra rows so every availability state and the inactive state are visible
  { name: 'Keyboard', type: 'Electronics', purchaseDate: '2026-08-18', stock: 8, active: true },
  { name: 'Notebook', type: 'Stationery', purchaseDate: '2026-08-12', stock: 4, active: true },
  { name: 'Cotton T-Shirt', type: 'Clothing', purchaseDate: '2026-07-30', stock: 0, active: true },
  { name: 'Rice Bag 10kg', type: 'Grocery', purchaseDate: '2026-09-01', stock: 12, active: true },
  { name: 'Legacy Printer', type: 'Electronics', purchaseDate: '2025-11-05', stock: 3, active: false },
];

export function seed({ force = false } = {}) {
  if (force) reset();
  if (tables.itemTypes.length > 0) return stats();

  const timestamp = nowIso();
  const typeIdByName = new Map();

  for (const typeName of ITEM_TYPES) {
    const row = {
      id: nextId('itemTypes'),
      typeName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    tables.itemTypes.push(row);
    typeIdByName.set(typeName, row.id);
  }

  for (const item of ITEMS) {
    tables.items.push({
      id: nextId('items'),
      name: item.name,
      itemTypeId: typeIdByName.get(item.type),
      purchaseDate: item.purchaseDate,
      stockAvailable: item.stock,
      active: item.active,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  return stats();
}
