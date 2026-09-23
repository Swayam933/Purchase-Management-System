-- ============================================================================
--  Item & Purchase Management System - sample data
--
--  Mirrors the demo dataset the Node app loads in memory. Item types come from
--  the assignment; the first three items reproduce the "Initial Item Master" of
--  section 17 (Laptop 10, Mouse 20, Chair 15). No purchases are seeded.
--
--  Run AFTER schema.sql:
--     mysql -u root -p < database/seed.sql
--  or from inside the mysql shell:
--     SOURCE database/seed.sql;
-- ============================================================================

USE item_purchase_db;

-- Re-runnable: clear existing rows and reset AUTO_INCREMENT counters.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE purchase_items;
TRUNCATE TABLE purchases;
TRUNCATE TABLE items;
TRUNCATE TABLE item_types;
SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO item_types (id, type_name) VALUES
  (1, 'Electronics'),
  (2, 'Furniture'),
  (3, 'Clothing'),
  (4, 'Grocery'),
  (5, 'Stationery');

INSERT INTO items (name, item_type_id, purchase_date, stock_available, active) VALUES
  ('Laptop',         1, '2026-08-25', 10, 1),  -- section 17 initial master
  ('Mouse',          1, '2026-08-25', 20, 1),
  ('Chair',          2, '2026-08-20', 15, 1),
  ('Keyboard',       1, '2026-08-18',  8, 1),
  ('Notebook',       5, '2026-08-12',  4, 1),  -- Low Stock
  ('Cotton T-Shirt', 3, '2026-07-30',  0, 1),  -- Out of Stock
  ('Rice Bag 10kg',  4, '2026-09-01', 12, 1),
  ('Legacy Printer', 1, '2025-11-05',  3, 0);  -- Inactive, not purchasable

-- No purchases are seeded so purchase history starts clean.
