import { api } from '../api.js';
import {
  availabilityBadge,
  card,
  confirmDialog,
  emptyState,
  formatDate,
  formatDateTime,
  h,
  link,
  notice,
  pageHead,
  render,
  statusBadge,
  table,
  toast,
} from '../ui.js';
import { navigate } from '../router.js';

/** Item Details screen. */
export default async function itemDetailsView(container, { id }) {
  const item = await api.items.get(id);

  const detail = (label, value) => h('div', null, h('dt', null, label), h('dd', null, value));

  const historyBody =
    item.purchaseHistory.length === 0
      ? emptyState('Never purchased', 'This item has not been used in any purchase yet.')
      : table({
          columns: [
            { label: 'Order ID' },
            { label: 'Purchase Date' },
            { label: 'Quantity', numeric: true },
            { label: '' },
          ],
          rows: item.purchaseHistory.map((entry) =>
            h(
              'tr',
              null,
              h('td', { class: 'mono' }, entry.orderId),
              h('td', null, formatDate(entry.purchaseDate)),
              h('td', { class: 'num' }, entry.quantity),
              h('td', null, link(`#/purchases/${entry.purchaseId}`, 'View order')),
            ),
          ),
          footer: h(
            'tr',
            null,
            h('td', { colspan: '2' }, 'Total purchased'),
            h('td', { class: 'num' }, item.totalPurchased),
            h('td'),
          ),
        });

  render(
    container,
    h('p', { class: 'breadcrumb' }, h('a', { href: '#/items' }, 'Items'), ' / ', item.name),
    pageHead({
      title: item.name,
      subtitle: `Item #${item.id} · ${item.itemTypeName}`,
      actions: [
        link(`#/items/${item.id}/edit`, 'Edit', 'btn'),
        h(
          'button',
          {
            type: 'button',
            class: 'btn',
            onClick: async () => {
              try {
                await api.items.setStatus(item.id, !item.active);
                toast(`"${item.name}" is now ${item.active ? 'inactive' : 'active'}`, 'success');
                itemDetailsView(container, { id });
              } catch (error) {
                toast(error.message, 'error');
              }
            },
          },
          item.active ? 'Deactivate' : 'Activate',
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn--danger',
            disabled: !item.canDelete,
            title: item.canDelete
              ? 'Delete this item'
              : 'This item appears in a purchase and cannot be deleted',
            onClick: async () => {
              const confirmed = await confirmDialog({
                title: 'Delete item?',
                message: `"${item.name}" will be permanently removed.`,
                confirmLabel: 'Delete',
                danger: true,
              });
              if (!confirmed) return;
              try {
                await api.items.remove(item.id);
                toast('Item deleted', 'success');
                navigate('/items');
              } catch (error) {
                toast(error.message, 'error');
              }
            },
          },
          'Delete',
        ),
      ],
    }),

    item.canDelete
      ? null
      : notice(
          'This item is referenced by purchase history',
          'info',
          [
            'Deleting it would break existing purchase records. Mark it inactive instead: historical purchases stay readable and the item can no longer be added to new orders.',
          ],
        ),

    card({
      title: 'Item Details',
      body: h(
        'dl',
        { class: 'detail-grid' },
        detail('Item ID', h('span', { class: 'mono' }, item.id)),
        detail('Item Name', item.name),
        detail('Item Type', item.itemTypeName),
        detail('Purchase Date', formatDate(item.purchaseDate)),
        detail('Current Stock', h('strong', null, item.stockAvailable)),
        detail('Availability', availabilityBadge(item.availability)),
        detail('Status', statusBadge(item.active)),
        detail('Total Purchased', item.totalPurchased),
        detail('Created', formatDateTime(item.createdAt)),
        detail('Last Updated', formatDateTime(item.updatedAt)),
      ),
    }),

    card({
      title: 'Purchase History',
      subtitle: 'Orders containing this item (purchases JOIN purchase_items).',
      flush: true,
      body: historyBody,
    }),
  );
}
