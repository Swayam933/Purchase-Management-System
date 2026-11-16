import { pool, query } from './mysql.js';

const ITEM_TYPES = ['Electronics', 'Furniture', 'Clothing', 'Grocery', 'Stationery'];

const ITEMS = [
  { name: 'Laptop', type: 'Electronics', purchaseDate: '2026-08-25', stock: 10, active: true },
  { name: 'Mouse', type: 'Electronics', purchaseDate: '2026-08-25', stock: 20, active: true },
  { name: 'Chair', type: 'Furniture', purchaseDate: '2026-08-20', stock: 15, active: true },
  { name: 'Keyboard', type: 'Electronics', purchaseDate: '2026-08-18', stock: 8, active: true },
  { name: 'Notebook', type: 'Stationery', purchaseDate: '2026-08-12', stock: 4, active: true },
  { name: 'Cotton T-Shirt', type: 'Clothing', purchaseDate: '2026-07-30', stock: 0, active: true },
  { name: 'Rice Bag 10kg', type: 'Grocery', purchaseDate: '2026-09-01', stock: 12, active: true },
  { name: 'Legacy Printer', type: 'Electronics', purchaseDate: '2025-11-05', stock: 3, active: false },
];

export async function seed() {
  for (const typeName of ITEM_TYPES) {
    await query(pool, 'INSERT IGNORE INTO item_types (type_name) VALUES (?)', [typeName]);
  }

  const typeRows = await query(pool, 'SELECT id, type_name AS typeName FROM item_types');
  const typeIdByName = new Map(typeRows.map((type) => [type.typeName.toLowerCase(), type.id]));

  for (const item of ITEMS) {
    await query(
      pool,
      `INSERT IGNORE INTO items
        (name, item_type_id, purchase_date, stock_available, active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        item.name,
        typeIdByName.get(item.type.toLowerCase()),
        item.purchaseDate,
        item.stock,
        item.active ? 1 : 0,
      ],
    );
  }

  return query(
    pool,
    `SELECT
       (SELECT COUNT(*) FROM item_types) AS itemTypes,
       (SELECT COUNT(*) FROM items) AS items,
       (SELECT COUNT(*) FROM purchases) AS purchases,
       (SELECT COUNT(*) FROM purchase_items) AS purchaseItems`,
  ).then(([counts]) => Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, Number(value)]),
  ));
}
