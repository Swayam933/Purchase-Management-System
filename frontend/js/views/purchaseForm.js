import { api } from '../api.js';
import { navigate } from '../router.js';
import {
  applyFieldErrors,
  badge,
  card,
  clear,
  emptyState,
  field,
  h,
  link,
  notice,
  pageHead,
  render,
  table,
  todayIso,
  toast,
  withBusy,
} from '../ui.js';

/**
 * Create / Update Purchase screen (assignment sections 3.2 and 7).
 *
 * One order, many items. Lines are assembled locally and submitted as a single
 * request so the backend can process the whole purchase in one transaction.
 */
export default async function purchaseFormView(container, { mode, id }) {
  const isEdit = mode === 'edit';

  const [selectableItems, purchase, nextOrder] = await Promise.all([
    api.items.list({ active: 'true' }),
    isEdit ? api.purchases.get(id) : Promise.resolve(null),
    isEdit ? Promise.resolve(null) : api.purchases.nextOrderId(),
  ]);

  /**
   * Quantities the saved order already holds, kept aside so removing and
   * re-adding a line restores the correct quantity ceiling.
   */
  const originalQuantities = new Map(
    (purchase?.items ?? []).map((line) => [line.itemId, line.quantity]),
  );

  /** Local line state. `originalQuantity` is what the saved order already holds. */
  let lines = isEdit
    ? purchase.items.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        itemTypeName: line.itemTypeName,
        quantity: line.quantity,
        originalQuantity: line.quantity,
        currentStock: line.currentStock,
        active: line.itemActive,
      }))
    : [];

  /**
   * Largest quantity this line may hold.
   * The units already booked by this order are available to it again, so the
   * ceiling is current stock + the quantity already on the order. An inactive
   * item can never grow beyond what it already has.
   */
  const maxFor = (line) =>
    line.active ? line.currentStock + line.originalQuantity : line.originalQuantity;

  /** Stock the item will end up with once the order is saved. */
  const projectedStock = (line) => line.currentStock + line.originalQuantity - line.quantity;

  /* ----------------------------------------------------------- order header */

  const orderIdInput = h('input', {
    type: 'text',
    id: 'orderId',
    name: 'orderId',
    maxlength: '30',
    class: 'mono',
    value: isEdit ? purchase.orderId : nextOrder.orderId,
    readOnly: isEdit,
    disabled: isEdit,
  });

  const dateInput = h('input', {
    type: 'date',
    id: 'purchaseDate',
    name: 'purchaseDate',
    required: true,
    value: isEdit ? purchase.purchaseDate : todayIso(),
  });

  /* -------------------------------------------------------- line builder */

  const itemSelect = h('select', { id: 'lineItem', name: 'lineItemId' });
  const qtyInput = h('input', {
    type: 'number',
    id: 'lineQty',
    name: 'lineQuantity',
    min: '1',
    step: '1',
    value: '1',
  });
  const addButton = h(
    'button',
    { type: 'button', class: 'btn btn--primary', onClick: addLine },
    'Add to Order',
  );

  const linesSlot = h('div');
  const summarySlot = h('div', { class: 'stat-grid' });

  function refreshItemSelect() {
    const used = new Set(lines.map((line) => line.itemId));
    const available = selectableItems.filter(
      (item) => !used.has(item.id) && item.stockAvailable > 0,
    );

    clear(itemSelect);
    if (available.length === 0) {
      itemSelect.append(h('option', { value: '' }, 'No selectable items left'));
      itemSelect.disabled = true;
      addButton.disabled = true;
      qtyInput.disabled = true;
      return;
    }

    itemSelect.disabled = false;
    addButton.disabled = false;
    qtyInput.disabled = false;
    itemSelect.append(h('option', { value: '' }, '— Select an item —'));
    for (const item of available) {
      itemSelect.append(
        h(
          'option',
          { value: item.id },
          `${item.name} · ${item.itemTypeName} · ${item.stockAvailable} in stock`,
        ),
      );
    }
  }

  function addLine() {
    const itemId = Number(itemSelect.value);
    const quantity = Number(qtyInput.value);

    if (!itemId) {
      toast('Select an item first', 'error');
      itemSelect.focus();
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast('Quantity must be greater than zero', 'error');
      qtyInput.focus();
      return;
    }

    const item = selectableItems.find((candidate) => candidate.id === itemId);
    if (!item) return;

    // Re-adding a line that this order already had gets its booked units back.
    const originalQuantity = originalQuantities.get(item.id) ?? 0;
    const max = item.stockAvailable + originalQuantity;

    if (quantity > max) {
      toast(`Only ${max} unit(s) of "${item.name}" available`, 'error');
      qtyInput.focus();
      return;
    }

    lines.push({
      itemId: item.id,
      itemName: item.name,
      itemTypeName: item.itemTypeName,
      quantity,
      originalQuantity,
      currentStock: item.stockAvailable,
      active: true,
    });

    qtyInput.value = '1';
    drawLines();
    toast(`${item.name} × ${quantity} added to the order`, 'success');
  }

  function removeLine(itemId) {
    lines = lines.filter((line) => line.itemId !== itemId);
    drawLines();
  }

  /* ---------------------------------------------------------------- render */

  function drawSummary() {
    const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
    render(
      summarySlot,
      h(
        'div',
        { class: 'stat stat--primary' },
        h('div', { class: 'stat__label' }, 'Order ID'),
        h('div', { class: 'stat__value mono' }, isEdit ? purchase.orderId : nextOrder.orderId),
      ),
      h(
        'div',
        { class: 'stat' },
        h('div', { class: 'stat__label' }, 'Items on order'),
        h('div', { class: 'stat__value' }, lines.length),
      ),
      h(
        'div',
        { class: 'stat' },
        h('div', { class: 'stat__label' }, 'Total quantity'),
        h('div', { class: 'stat__value' }, totalQuantity),
      ),
    );
  }

  function drawLines() {
    refreshItemSelect();
    drawSummary();
    clear(linesSlot);

    if (lines.length === 0) {
      linesSlot.append(
        card({
          title: 'Order Items',
          flush: true,
          body: emptyState(
            'No items added yet',
            'Select an item and a quantity above, then add it to this order.',
          ),
        }),
      );
      return;
    }

    const totalCell = h('td', { class: 'num' });
    const updateTotals = () => {
      totalCell.textContent = String(lines.reduce((sum, line) => sum + line.quantity, 0));
      drawSummary();
    };

    const rows = lines.map((line) => {
      const max = maxFor(line);
      const projectedCell = h('td', { class: 'num' }, projectedStock(line));

      const lineQtyInput = h('input', {
        type: 'number',
        min: '1',
        max: String(max),
        step: '1',
        value: String(line.quantity),
        'aria-label': `Quantity for ${line.itemName}`,
        style: { maxWidth: '110px' },
        onInput: (event) => {
          const value = Number(event.target.value);
          line.quantity = Number.isInteger(value) && value > 0 ? value : 0;
          projectedCell.textContent = String(projectedStock(line));
          const overMax = line.quantity > max;
          event.target.setAttribute('aria-invalid', overMax ? 'true' : 'false');
          updateTotals();
        },
      });

      return h(
        'tr',
        { class: line.active ? undefined : 'row--inactive' },
        h(
          'td',
          null,
          h('strong', null, line.itemName),
          line.active ? null : ' ',
          line.active ? null : badge('Inactive', 'neutral'),
        ),
        h('td', null, line.itemTypeName ?? '—'),
        h('td', { class: 'num' }, max),
        h('td', null, lineQtyInput),
        projectedCell,
        h(
          'td',
          null,
          h(
            'button',
            {
              type: 'button',
              class: 'btn btn--sm btn--danger',
              onClick: () => removeLine(line.itemId),
            },
            'Remove',
          ),
        ),
      );
    });

    updateTotals();

    linesSlot.append(
      card({
        title: 'Order Items',
        subtitle: isEdit
          ? 'Changing a quantity adjusts stock by the difference when you save.'
          : 'Stock is deducted once the order is submitted.',
        flush: true,
        body: table({
          columns: [
            { label: 'Item' },
            { label: 'Item Type' },
            { label: 'Max Qty', numeric: true },
            { label: 'Quantity' },
            { label: 'Stock After', numeric: true },
            { label: '' },
          ],
          rows,
          footer: h(
            'tr',
            null,
            h('td', { colspan: '3' }, 'Total quantity'),
            totalCell,
            h('td', { colspan: '2' }),
          ),
        }),
      }),
    );
  }

  /* ---------------------------------------------------------------- submit */

  const submit = h(
    'button',
    { type: 'submit', class: 'btn btn--primary', form: 'purchase-form' },
    isEdit ? 'Save Changes' : 'Submit Purchase',
  );

  const headerForm = h(
    'form',
    {
      id: 'purchase-form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        applyFieldErrors(headerForm, {});

        if (lines.length === 0) {
          toast('Purchase must contain at least one item', 'error');
          itemSelect.focus();
          return;
        }
        if (lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1)) {
          toast('Quantity must be greater than zero on every line', 'error');
          return;
        }

        const payload = {
          purchaseDate: dateInput.value,
          items: lines.map((line) => ({ itemId: line.itemId, quantity: line.quantity })),
        };
        if (!isEdit) {
          const trimmed = orderIdInput.value.trim();
          if (trimmed) payload.orderId = trimmed;
        }

        try {
          const saved = await withBusy(submit, 'Saving…', () =>
            isEdit ? api.purchases.update(purchase.id, payload) : api.purchases.create(payload),
          );
          toast(
            isEdit ? `${saved.orderId} updated` : `${saved.orderId} created and stock updated`,
            'success',
          );
          navigate(`/purchases/${saved.id}`);
        } catch (error) {
          applyFieldErrors(headerForm, error.fieldErrors);
          toast(error.message, 'error');
        }
      },
    },
    h(
      'div',
      { class: 'form-grid' },
      field({
        label: 'Order ID',
        name: 'orderId',
        control: orderIdInput,
        required: !isEdit,
        hint: isEdit
          ? 'The Order ID of a saved purchase cannot be changed.'
          : 'Pre-filled with the next available ID. You can override it.',
      }),
      field({ label: 'Purchase Date', name: 'purchaseDate', control: dateInput, required: true }),
    ),
  );

  render(
    container,
    h(
      'p',
      { class: 'breadcrumb' },
      h('a', { href: '#/purchases' }, 'Purchases'),
      ' / ',
      isEdit ? `Update ${purchase.orderId}` : 'Create purchase',
    ),
    pageHead({
      title: isEdit ? `Update ${purchase.orderId}` : 'Create Purchase',
      subtitle: isEdit
        ? 'Stock is reconciled by the difference between the old and new quantities.'
        : 'Add several items to one order. Only active items with stock are selectable.',
    }),
    summarySlot,
    isEdit
      ? notice('This order already affected stock', 'info', [
          'Quantities you lower are returned to stock, quantities you raise are deducted again, and removed lines give their full quantity back.',
        ])
      : null,
    card({ title: 'Purchase Information', body: headerForm }),
    card({
      title: 'Add Item',
      subtitle: 'Inactive items and items with zero stock are not selectable.',
      body: h(
        'div',
        { class: 'line-builder' },
        field({ label: 'Item', name: 'lineItemId', control: itemSelect }),
        field({ label: 'Quantity', name: 'lineQuantity', control: qtyInput }),
        h('div', { class: 'btn-row' }, addButton),
      ),
    }),
    linesSlot,
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'card__foot' },
        link(isEdit ? `#/purchases/${purchase.id}` : '#/purchases', 'Cancel', 'btn'),
        submit,
      ),
    ),
  );

  drawLines();
}
