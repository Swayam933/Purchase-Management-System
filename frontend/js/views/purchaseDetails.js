import { api } from '../api.js';
import {
  availabilityBadge,
  badge,
  card,
  formatDate,
  formatDateTime,
  h,
  link,
  notice,
  pageHead,
  render,
  table,
} from '../ui.js';

/**
 * Purchase Details screen (assignment section 3.3).
 *
 * Actions are View and Update only. No Delete button is rendered anywhere.
 */
export default async function purchaseDetailsView(container, { id }) {
  const purchase = await api.purchases.get(id);

  const detail = (label, value) => h('div', null, h('dt', null, label), h('dd', null, value));

  const rows = purchase.items.map((line) =>
    h(
      'tr',
      { class: line.itemActive ? undefined : 'row--inactive' },
      h('td', { class: 'num mono' }, line.itemId),
      h(
        'td',
        null,
        h('a', { href: `#/items/${line.itemId}` }, line.itemName),
        line.itemActive ? null : ' ',
        line.itemActive ? null : badge('Inactive', 'neutral'),
      ),
      h('td', null, line.itemTypeName ?? '—'),
      h('td', { class: 'num' }, h('strong', null, line.quantity)),
      h('td', { class: 'num' }, line.currentStock),
      h('td', null, availabilityBadge(line.availability)),
    ),
  );

  render(
    container,
    h(
      'p',
      { class: 'breadcrumb' },
      h('a', { href: '#/purchases' }, 'Purchases'),
      ' / ',
      purchase.orderId,
    ),
    pageHead({
      title: `Order ${purchase.orderId}`,
      subtitle: `${purchase.lineCount} item(s) · ${purchase.totalQuantity} unit(s) · ${formatDate(purchase.purchaseDate)}`,
      actions: [
        link(`#/purchases/${purchase.id}/edit`, 'Update Purchase', 'btn btn--primary'),
        link('#/purchases', 'Back to list', 'btn'),
      ],
    }),

    card({
      title: 'Purchase Information',
      body: h(
        'dl',
        { class: 'detail-grid' },
        detail('Order ID', h('span', { class: 'mono' }, purchase.orderId)),
        detail('Purchase Date', formatDate(purchase.purchaseDate)),
        detail('Distinct Items', purchase.lineCount),
        detail('Total Quantity', purchase.totalQuantity),
        detail('Created', formatDateTime(purchase.createdAt)),
        detail('Last Updated', formatDateTime(purchase.updatedAt)),
      ),
    }),

    card({
      title: 'Items in this Order',
      subtitle:
        'Joined across purchases, purchase_items, items and item_types. Current Stock is the item stock right now.',
      flush: true,
      body: table({
        columns: [
          { label: 'Item ID', numeric: true },
          { label: 'Item Name' },
          { label: 'Item Type' },
          { label: 'Quantity', numeric: true },
          { label: 'Current Stock', numeric: true },
          { label: 'Availability' },
        ],
        rows,
        footer: h(
          'tr',
          null,
          h('td', { colspan: '3' }, 'Total'),
          h('td', { class: 'num' }, purchase.totalQuantity),
          h('td', { colspan: '2' }),
        ),
      }),
    }),

    notice('This purchase cannot be deleted', 'info', [
      'Purchases are historical transactions. Use Update Purchase to correct quantities; stock is adjusted by the difference between the old and new values.',
    ]),
  );
}
