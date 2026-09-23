import { api } from '../api.js';
import {
  availabilityBadge,
  card,
  clear,
  emptyState,
  field,
  h,
  link,
  pageHead,
  render,
  statusBadge,
  table,
} from '../ui.js';

/** Stock / Availability screen (assignment section 3.4). */
export default async function stockView(container) {
  const filters = { q: '', itemTypeId: 'all', availability: 'all', active: 'all' };
  const itemTypes = await api.itemTypes.list();

  const statsSlot = h('div', { class: 'stat-grid' });
  const tableSlot = h('div');

  const searchInput = h('input', { type: 'search', id: 'stock-q', name: 'q', placeholder: 'Item name' });

  const typeSelect = h(
    'select',
    { id: 'stock-type', name: 'itemTypeId' },
    h('option', { value: 'all' }, 'All types'),
    ...itemTypes.map((type) => h('option', { value: type.id }, type.typeName)),
  );

  const availabilitySelect = h(
    'select',
    { id: 'stock-availability', name: 'availability' },
    h('option', { value: 'all' }, 'Any availability'),
    h('option', { value: 'in_stock' }, 'In stock'),
    h('option', { value: 'low_stock' }, 'Low stock'),
    h('option', { value: 'out_of_stock' }, 'Out of stock'),
  );

  const statusSelect = h(
    'select',
    { id: 'stock-status', name: 'active' },
    h('option', { value: 'all' }, 'All statuses'),
    h('option', { value: 'true' }, 'Active only'),
    h('option', { value: 'false' }, 'Inactive only'),
  );

  let debounce;
  const onFilterChange = () => {
    filters.q = searchInput.value.trim();
    filters.itemTypeId = typeSelect.value;
    filters.availability = availabilitySelect.value;
    filters.active = statusSelect.value;
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 180);
  };

  searchInput.addEventListener('input', onFilterChange);
  for (const select of [typeSelect, availabilitySelect, statusSelect]) {
    select.addEventListener('change', onFilterChange);
  }

  render(
    container,
    pageHead({
      title: 'Stock & Availability',
      subtitle: 'Live stock per item with availability derived from the current quantity.',
      actions: [link('#/purchases/new', '+ Create Purchase', 'btn btn--primary')],
    }),
    statsSlot,
    card({
      title: 'Filters',
      body: h(
        'div',
        { class: 'filter-bar' },
        field({ label: 'Search', name: 'q', control: searchInput }),
        field({ label: 'Item type', name: 'itemTypeId', control: typeSelect }),
        field({ label: 'Availability', name: 'availability', control: availabilitySelect }),
        field({ label: 'Status', name: 'active', control: statusSelect }),
      ),
    }),
    tableSlot,
  );

  const stat = (label, value, variant = '') =>
    h(
      'div',
      { class: `stat${variant ? ` stat--${variant}` : ''}` },
      h('div', { class: 'stat__label' }, label),
      h('div', { class: 'stat__value' }, value),
    );

  async function refresh() {
    const { summary, items } = await api.stock.overview(filters);

    render(
      statsSlot,
      stat('Total items', summary.totalItems, 'primary'),
      stat('In stock', summary.inStock, 'success'),
      stat(`Low stock (≤ ${summary.lowStockThreshold})`, summary.lowStock, 'warning'),
      stat('Out of stock', summary.outOfStock, 'danger'),
      stat('Units on hand', summary.totalUnits),
      stat('Inactive items', summary.inactiveItems),
    );

    clear(tableSlot);

    if (items.length === 0) {
      tableSlot.append(
        card({
          title: 'Stock Levels',
          flush: true,
          body: emptyState('No items match these filters', 'Try widening the filters above.'),
        }),
      );
      return;
    }

    const rows = items.map((item) =>
      h(
        'tr',
        { class: item.active ? undefined : 'row--inactive' },
        h('td', { class: 'num mono' }, item.id),
        h('td', null, h('a', { href: `#/items/${item.id}` }, item.name)),
        h('td', null, item.itemTypeName),
        h('td', { class: 'num' }, h('strong', null, item.stockAvailable)),
        h('td', null, availabilityBadge(item.availability)),
        h('td', null, statusBadge(item.active)),
      ),
    );

    tableSlot.append(
      card({
        title: 'Stock Levels',
        subtitle: `${items.length} item(s) · > 0 In Stock · = 0 Out of Stock · ≤ ${summary.lowStockThreshold} Low Stock`,
        flush: true,
        body: table({
          columns: [
            { label: 'Item ID', numeric: true },
            { label: 'Item' },
            { label: 'Type' },
            { label: 'Current Stock', numeric: true },
            { label: 'Availability' },
            { label: 'Status' },
          ],
          rows,
          footer: h(
            'tr',
            null,
            h('td', { colspan: '3' }, 'Units shown'),
            h('td', { class: 'num' }, items.reduce((sum, item) => sum + item.stockAvailable, 0)),
            h('td', { colspan: '2' }),
          ),
        }),
      }),
    );
  }

  await refresh();
}
