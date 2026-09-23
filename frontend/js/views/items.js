import { api } from '../api.js';
import {
  availabilityBadge,
  card,
  clear,
  confirmDialog,
  emptyState,
  field,
  formatDate,
  h,
  link,
  pageHead,
  render,
  statusBadge,
  table,
  toast,
} from '../ui.js';

/** Item Master / Item List screen. */
export default async function itemsView(container) {
  const filters = { q: '', itemTypeId: 'all', active: 'all', availability: 'all' };
  const itemTypes = await api.itemTypes.list();

  const tableSlot = h('div');

  const searchInput = h('input', {
    type: 'search',
    id: 'filter-q',
    name: 'q',
    placeholder: 'Item or type name',
  });

  const typeSelect = h(
    'select',
    { id: 'filter-type', name: 'itemTypeId' },
    h('option', { value: 'all' }, 'All types'),
    ...itemTypes.map((type) => h('option', { value: type.id }, type.typeName)),
  );

  const statusSelect = h(
    'select',
    { id: 'filter-status', name: 'active' },
    h('option', { value: 'all' }, 'All statuses'),
    h('option', { value: 'true' }, 'Active only'),
    h('option', { value: 'false' }, 'Inactive only'),
  );

  const availabilitySelect = h(
    'select',
    { id: 'filter-availability', name: 'availability' },
    h('option', { value: 'all' }, 'Any availability'),
    h('option', { value: 'in_stock' }, 'In stock'),
    h('option', { value: 'low_stock' }, 'Low stock'),
    h('option', { value: 'out_of_stock' }, 'Out of stock'),
  );

  let debounce;
  const onFilterChange = () => {
    filters.q = searchInput.value.trim();
    filters.itemTypeId = typeSelect.value;
    filters.active = statusSelect.value;
    filters.availability = availabilitySelect.value;
    clearTimeout(debounce);
    debounce = setTimeout(refresh, 180);
  };

  searchInput.addEventListener('input', onFilterChange);
  for (const select of [typeSelect, statusSelect, availabilitySelect]) {
    select.addEventListener('change', onFilterChange);
  }

  render(
    container,
    pageHead({
      title: 'Item Master',
      subtitle: 'Create, review and maintain items. Item type comes from a SQL JOIN.',
      actions: [link('#/items/new', '+ Add Item', 'btn btn--primary')],
    }),
    card({
      title: 'Filters',
      body: h(
        'div',
        { class: 'filter-bar' },
        field({ label: 'Search', name: 'q', control: searchInput }),
        field({ label: 'Item type', name: 'itemTypeId', control: typeSelect }),
        field({ label: 'Status', name: 'active', control: statusSelect }),
        field({ label: 'Availability', name: 'availability', control: availabilitySelect }),
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
                typeSelect.value = 'all';
                statusSelect.value = 'all';
                availabilitySelect.value = 'all';
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

  async function toggleStatus(item) {
    try {
      await api.items.setStatus(item.id, !item.active);
      toast(`"${item.name}" is now ${item.active ? 'inactive' : 'active'}`, 'success');
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function removeItem(item) {
    const confirmed = await confirmDialog({
      title: 'Delete item?',
      message: `"${item.name}" will be permanently removed. Items already used in a purchase cannot be deleted; deactivate them instead.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api.items.remove(item.id);
      toast('Item deleted', 'success');
      await refresh();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function refresh() {
    let items;
    try {
      items = await api.items.list(filters);
    } catch (error) {
      render(tableSlot, card({ title: 'Items', body: emptyState('Could not load items', error.message) }));
      return;
    }

    clear(tableSlot);

    if (items.length === 0) {
      tableSlot.append(
        card({
          title: 'Items',
          flush: true,
          body: emptyState(
            'No items match these filters',
            'Adjust the filters above or add a new item.',
            link('#/items/new', '+ Add Item', 'btn btn--primary'),
          ),
        }),
      );
      return;
    }

    const rows = items.map((item) =>
      h(
        'tr',
        { class: item.active ? undefined : 'row--inactive' },
        h('td', { class: 'num mono' }, item.id),
        h('td', null, h('strong', null, item.name)),
        h('td', null, item.itemTypeName),
        h('td', null, formatDate(item.purchaseDate)),
        h('td', { class: 'num' }, item.stockAvailable),
        h('td', null, availabilityBadge(item.availability)),
        h('td', null, statusBadge(item.active)),
        h(
          'td',
          null,
          h(
            'div',
            { class: 'actions' },
            link(`#/items/${item.id}`, 'View'),
            link(`#/items/${item.id}/edit`, 'Edit'),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn--sm',
                onClick: () => toggleStatus(item),
              },
              item.active ? 'Deactivate' : 'Activate',
            ),
            h(
              'button',
              { type: 'button', class: 'btn btn--sm btn--danger', onClick: () => removeItem(item) },
              'Delete',
            ),
          ),
        ),
      ),
    );

    tableSlot.append(
      card({
        title: 'Items',
        subtitle: `${items.length} item(s)`,
        flush: true,
        body: table({
          columns: [
            { label: 'Item ID', numeric: true },
            { label: 'Name' },
            { label: 'Type' },
            { label: 'Purchase Date' },
            { label: 'Current Stock', numeric: true },
            { label: 'Availability' },
            { label: 'Status' },
            { label: 'Actions' },
          ],
          rows,
        }),
      }),
    );
  }

  await refresh();
}
