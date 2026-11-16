-- ============================================================================
--  Item & Purchase Management System - MySQL schema
--  Matches the design in section 10 of the assignment.
--
--  Run with:
--     mysql -u root -p < database/schema.sql
--  or from inside the mysql shell:
--     SOURCE database/schema.sql;
-- ============================================================================

CREATE DATABASE IF NOT EXISTS item_purchase_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE item_purchase_db;

-- Drop in dependency order so the script is re-runnable.
DROP TABLE IF EXISTS purchase_items;
DROP TABLE IF EXISTS purchases;
DROP TABLE IF EXISTS purchase_order_sequence;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS item_types;

-- ----------------------------------------------------------------------------
-- 10.1 item_types : Item Type categories
-- ----------------------------------------------------------------------------
CREATE TABLE item_types (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name  VARCHAR(100) NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_types_name (type_name)
) ENGINE = InnoDB;

-- ----------------------------------------------------------------------------
-- 10.2 items : Item Master information and current stock
-- ----------------------------------------------------------------------------
CREATE TABLE items (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150) NOT NULL,
  item_type_id    INT UNSIGNED NOT NULL,
  purchase_date   DATE         NOT NULL,
  stock_available INT          NOT NULL DEFAULT 0,
  active          TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_name (name),
  KEY idx_items_type (item_type_id),
  -- Stock can never be negative (assignment section 6).
  CONSTRAINT chk_items_stock_nonneg CHECK (stock_available >= 0),
  -- An item type in use cannot be deleted (ON DELETE RESTRICT).
  CONSTRAINT fk_items_type FOREIGN KEY (item_type_id)
    REFERENCES item_types (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ----------------------------------------------------------------------------
-- 10.3 purchases : Purchase/Order header
-- ----------------------------------------------------------------------------
CREATE TABLE purchases (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id      VARCHAR(30)  NOT NULL,
  purchase_date DATE         NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_order_id (order_id)
) ENGINE = InnoDB;

-- A locked singleton row allocates generated PO numbers without races.
CREATE TABLE purchase_order_sequence (
  id         TINYINT UNSIGNED NOT NULL,
  next_value INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT chk_purchase_order_sequence_singleton CHECK (id = 1)
) ENGINE = InnoDB;

INSERT INTO purchase_order_sequence (id, next_value) VALUES (1, 1);

-- ----------------------------------------------------------------------------
-- 10.4 purchase_items : Items and quantities belonging to each Purchase
-- ----------------------------------------------------------------------------
CREATE TABLE purchase_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id INT UNSIGNED NOT NULL,
  item_id     INT UNSIGNED NOT NULL,
  quantity    INT          NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  -- One row per item within an order (duplicate items are rejected upstream).
  UNIQUE KEY uq_purchase_item (purchase_id, item_id),
  KEY idx_purchase_items_item (item_id),
  CONSTRAINT chk_purchase_items_qty_positive CHECK (quantity > 0),
  -- Purchases are historical: deleting a purchase would cascade its lines, but
  -- the application never deletes purchases (assignment section 8).
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id)
    REFERENCES purchases (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  -- An item referenced by history cannot be deleted (ON DELETE RESTRICT);
  -- deactivate it instead (assignment section 9).
  CONSTRAINT fk_purchase_items_item FOREIGN KEY (item_id)
    REFERENCES items (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ============================================================================
--  Mandatory JOIN queries (assignment section 12) - kept here for reference.
--  These are the exact reads the repository layer performs.
-- ============================================================================

-- Item + Item Type
--   SELECT i.id, i.name, it.type_name, i.purchase_date, i.stock_available, i.active
--   FROM items i
--   JOIN item_types it ON i.item_type_id = it.id
--   ORDER BY i.id;

-- Purchase + Purchase Items + Items + Item Types
--   SELECT p.order_id, p.purchase_date,
--          i.id AS item_id, i.name AS item_name, it.type_name, pi.quantity
--   FROM purchases p
--   JOIN purchase_items pi ON p.id = pi.purchase_id
--   JOIN items i           ON pi.item_id = i.id
--   JOIN item_types it     ON i.item_type_id = it.id
--   WHERE p.order_id = ?;
