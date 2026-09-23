import { db } from '../data/store.js';
import * as items from '../data/repositories/itemRepository.js';
import { config } from '../config/env.js';
import { AVAILABILITY } from '../utils/stock.js';
import { toItemDto } from './mappers.js';

/**
 * Stock / availability view (assignment section 3.4).
 *
 * Reuses the item -> item_type join and adds the aggregate counts the dashboard
 * cards display.
 */
export function overview(filters = {}) {
  const rows = items.findAllWithType(db, filters).map(toItemDto);

  // Counts always describe the whole catalogue, not the filtered subset, so the
  // summary cards stay stable while filtering.
  const all = items.findAllWithType(db).map(toItemDto);

  const summary = {
    totalItems: all.length,
    activeItems: all.filter((item) => item.active).length,
    inactiveItems: all.filter((item) => !item.active).length,
    inStock: all.filter((item) => item.availability.status === AVAILABILITY.IN_STOCK).length,
    lowStock: all.filter((item) => item.availability.status === AVAILABILITY.LOW_STOCK).length,
    outOfStock: all.filter((item) => item.availability.status === AVAILABILITY.OUT_OF_STOCK).length,
    totalUnits: all.reduce((sum, item) => sum + item.stockAvailable, 0),
    lowStockThreshold: config.lowStockThreshold,
  };

  return { summary, items: rows };
}
