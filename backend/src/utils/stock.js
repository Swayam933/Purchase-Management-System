import { config } from '../config/env.js';

export const AVAILABILITY = Object.freeze({
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock',
});

export const AVAILABILITY_LABELS = Object.freeze({
  [AVAILABILITY.IN_STOCK]: 'In Stock',
  [AVAILABILITY.LOW_STOCK]: 'Low Stock',
  [AVAILABILITY.OUT_OF_STOCK]: 'Out of Stock',
});

/**
 * Availability rules (assignment section 3.4):
 *   stock  > 0  -> In Stock
 *   stock == 0  -> Out of Stock
 *   stock <= 5  -> Low Stock (optional refinement of "In Stock")
 *
 * SQL equivalent once a database is wired in:
 *   CASE WHEN i.stock_available = 0 THEN 'out_of_stock'
 *        WHEN i.stock_available <= ? THEN 'low_stock'
 *        ELSE 'in_stock' END AS availability_status
 */
export function availabilityFor(stock) {
  const threshold = config.lowStockThreshold;
  const status =
    stock <= 0
      ? AVAILABILITY.OUT_OF_STOCK
      : threshold > 0 && stock <= threshold
        ? AVAILABILITY.LOW_STOCK
        : AVAILABILITY.IN_STOCK;

  return { status, label: AVAILABILITY_LABELS[status] };
}

/** True when `stock` satisfies the requested availability filter. */
export function matchesAvailability(stock, filter) {
  if (!filter) return true;
  const { status } = availabilityFor(stock);
  if (filter === AVAILABILITY.IN_STOCK) {
    // "In stock" is inclusive of low stock: anything with units on hand.
    return stock > 0;
  }
  return status === filter;
}
