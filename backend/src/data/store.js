/**
 * In-memory data store standing in for MySQL.
 *
 * It intentionally mirrors the relational shape required by the assignment so a
 * real database can replace it without touching services or controllers:
 *
 *   item_types      -> tables.itemTypes
 *   items           -> tables.items
 *   purchases       -> tables.purchases
 *   purchase_items  -> tables.purchaseItems
 *
 * Two database behaviours are emulated because the business rules depend on
 * them:
 *
 * 1. `transaction(work)` snapshots every table before running `work` and
 *    restores the snapshot if `work` throws -> BEGIN / COMMIT / ROLLBACK.
 * 2. Transactions are serialized through a queue, so a purchase can never
 *    interleave with another purchase and read stale stock -> the row locking
 *    (`SELECT ... FOR UPDATE`) a real implementation would rely on.
 */

/** @typedef {{ id: number, typeName: string, createdAt: string, updatedAt: string }} ItemTypeRow */
/** @typedef {{ id: number, name: string, itemTypeId: number, purchaseDate: string, stockAvailable: number, active: boolean, createdAt: string, updatedAt: string }} ItemRow */
/** @typedef {{ id: number, orderId: string, purchaseDate: string, createdAt: string, updatedAt: string }} PurchaseRow */
/** @typedef {{ id: number, purchaseId: number, itemId: number, quantity: number, createdAt: string }} PurchaseItemRow */

/** @type {{ itemTypes: ItemTypeRow[], items: ItemRow[], purchases: PurchaseRow[], purchaseItems: PurchaseItemRow[] }} */
export const tables = {
  itemTypes: [],
  items: [],
  purchases: [],
  purchaseItems: [],
};

const sequences = {
  itemTypes: 0,
  items: 0,
  purchases: 0,
  purchaseItems: 0,
};

const TABLE_NAMES = Object.keys(tables);

/** AUTO_INCREMENT emulation. */
export const nextId = (table) => (sequences[table] += 1);

export const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Serialized transactions
 * ------------------------------------------------------------------ */

let queue = Promise.resolve();

/** Runs `work` once every previously queued unit of work has settled. */
function withLock(work) {
  const result = queue.then(work, work);
  // Keep the chain alive regardless of whether `work` resolved or rejected.
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function snapshot() {
  return {
    tables: structuredClone(tables),
    sequences: { ...sequences },
  };
}

function restore(saved) {
  for (const name of TABLE_NAMES) tables[name] = saved.tables[name];
  Object.assign(sequences, saved.sequences);
}

/**
 * Executes `work` atomically. `work` receives the table handle and may mutate
 * it freely: if it throws, every mutation is rolled back.
 *
 * Mirrors the required purchase flow:
 *   BEGIN -> validate -> insert purchase -> insert purchase items
 *         -> update stock -> COMMIT (ROLLBACK on any failure)
 */
export function transaction(work) {
  return withLock(async () => {
    const saved = snapshot();
    try {
      return await work(tables);
    } catch (error) {
      restore(saved);
      throw error;
    }
  });
}

/** Read-only access for queries that do not need a transaction. */
export const db = tables;

/* ------------------------------------------------------------------ *
 * Test / bootstrap helpers
 * ------------------------------------------------------------------ */

export function reset() {
  for (const name of TABLE_NAMES) tables[name] = [];
  for (const name of Object.keys(sequences)) sequences[name] = 0;
}

export function stats() {
  return {
    itemTypes: tables.itemTypes.length,
    items: tables.items.length,
    purchases: tables.purchases.length,
    purchaseItems: tables.purchaseItems.length,
  };
}
