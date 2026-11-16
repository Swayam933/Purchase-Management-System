import { pool } from '../data/mysql.js';
import * as items from '../data/repositories/itemRepository.js';
import { config } from '../config/env.js';
import { AVAILABILITY } from '../utils/stock.js';
import { toItemDto } from './mappers.js';

export async function overview(filters = {}) {
  const [filteredRows, allRows] = await Promise.all([
    items.findAllWithType(pool, filters),
    items.findAllWithType(pool),
  ]);
  const rows = filteredRows.map(toItemDto);
  const all = allRows.map(toItemDto);

  return {
    summary: {
      totalItems: all.length,
      activeItems: all.filter((item) => item.active).length,
      inactiveItems: all.filter((item) => !item.active).length,
      inStock: all.filter((item) => item.availability.status === AVAILABILITY.IN_STOCK).length,
      lowStock: all.filter((item) => item.availability.status === AVAILABILITY.LOW_STOCK).length,
      outOfStock: all.filter((item) => item.availability.status === AVAILABILITY.OUT_OF_STOCK).length,
      totalUnits: all.reduce((sum, item) => sum + Number(item.stockAvailable), 0),
      lowStockThreshold: config.lowStockThreshold,
    },
    items: rows,
  };
}
