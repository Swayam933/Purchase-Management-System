import { api } from '../api.js';
import {
  card,
  clear,
  emptyState,
  field,
  formatDate,
  h,
  link,
  notice,
  pageHead,
  render,
  table,
} from '../ui.js';

/**
 * Purchase List screen.
 *
 * There is deliberately no Delete action: purchases are historical records
 * (assignment section 8).
 */
export default async function purchasesView(container) {
  const filters = { q: '', from: '', to: '' };
  const tableSlot = h('div');

  const searchInput = h('input', {
    type: 'search',
    id: 'filter-order',
    name: 'q',
    placeholder: 'e.g. PO-00001',
  });
  const fromInput = h('input', { type: 'date', id: 'filter-from', name: 'from' });
  const toInput = h('input', { type: 'date', id: 'filter-to', name: 'to' });

  let debounce;
  const onFilterChange = () => {
    filters.q = searchInput.value.trim();
    filters.from = fromInput.value;
    filters.to = toInput.value;
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 180);
  };

  searchInput.addEventListener('input', onFilterChange);
  fromInput.addEventListener('change', onFilterChange);
  toInput.addEventListener('change', onFilterChange);

  render(
    container,
    pageHead({
      title: 'Purchases',
      subtitle: 'One order can contain many items. Orders can be updated but never deleted.',
      actions: [link('#/purchases/new', '+ Create Purchase', 'btn btn--primary')],
    }),
    card({
      title: 'Filters',
      body: h(
        'div',
        { class: 'filter-bar' },
        field({ label: 'Order ID', name: 'q', control: searchInput }),
        field({ label: 'From date', name: 'from', control: fromInput }),
        field({ label: 'To date', name: 'to', control: toInput }),
        h(
          'div',
          { class: 'btn-row' },
          h(
            'button',
            {
              type: 'button',
              class: 'btn',
              onClick: () => {
                searchInput.value = '';
                fromInput.value = '';
                toInput.value = '';
                onFilterChange();
              },
            },
            'Reset',
          ),
        ),
      ),
    }),
    tableSlot,
  );

  async function refresh() {
    const purchases = await api.purchases.list(filters);
    clear(tableSlot);

    if (purchases.length === 0) {
      tableSlot.append(
        card({
          title: 'Purchase Orders',
          flush: true,
          body: emptyState(
            'No purchases found',
            'Create an order and add multiple items to it.',
            link('#/purchases/new', '+ Create Purchase', 'btn btn--primary'),
          ),
        }),
      );
      return;
    }

    const rows = purchases.map((purchase) =>
      h(
        'tr',
        null,
        h('td', { class: 'mono' }, h('strong', null, purchase.orderId)),
        h('td', null, formatDate(purchase.purchaseDate)),
        h('td', { class: 'num' }, purchase.lineCount),
        h('td', { class: 'num' }, purchase.totalQuantity),
        h(
          'td',
          null,
          h(
            'div',
            { class: 'actions' },
            link(`#/purchases/${purchase.id}`, 'View Details'),
            link(`#/purchases/${purchase.id}/edit`, 'Update'),
          ),
        ),
      ),
    );

    tableSlot.append(
      card({
        title: 'Purchase Orders',
        subtitle: `${purchases.length} order(s)`,
        flush: true,
        body: table({
          columns: [
            { label: 'Order ID' },
            { label: 'Purchase Date' },
            { label: 'Items', numeric: true },
            { label: 'Total Qty', numeric: true },
            { label: 'Actions' },
          ],
          rows,
        }),
      }),
      notice('Purchases cannot be deleted', 'info', [
        'They are historical transactions kept for audit and stock traceability. Use Update to correct quantities; stock is adjusted by the difference.',
      ]),
    );
  }

  await refresh();
}
