import { api } from '../api.js';
import { navigate } from '../router.js';
import {
  applyFieldErrors,
  card,
  field,
  h,
  notice,
  pageHead,
  render,
  todayIso,
  toast,
  withBusy,
} from '../ui.js';

/** Add / Edit Item form (assignment section 3.1). */
export default async function itemFormView(container, { mode, id }) {
  const isEdit = mode === 'edit';

  const [itemTypes, item] = await Promise.all([
    api.itemTypes.list(),
    isEdit ? api.items.get(id) : Promise.resolve(null),
  ]);

  if (itemTypes.length === 0) {
    render(
      container,
      pageHead({ title: isEdit ? 'Edit Item' : 'Add Item' }),
      notice(
        'No item types exist yet',
        'warning',
        ['An item must belong to an item type. Create one on the Item Types screen first.'],
      ),
      h('a', { class: 'btn btn--primary', href: '#/item-types' }, 'Go to Item Types'),
    );
    return;
  }

  const nameInput = h('input', {
    type: 'text',
    id: 'name',
    name: 'name',
    maxlength: '150',
    required: true,
    value: item?.name ?? '',
    placeholder: 'e.g. Laptop',
  });

  const typeSelect = h(
    'select',
    { id: 'itemTypeId', name: 'itemTypeId', required: true },
    h('option', { value: '' }, '— Select item type —'),
    ...itemTypes.map((type) =>
      h(
        'option',
        { value: type.id, selected: item?.itemTypeId === type.id },
        type.typeName,
      ),
    ),
  );

  const dateInput = h('input', {
    type: 'date',
    id: 'purchaseDate',
    name: 'purchaseDate',
    required: true,
    value: item?.purchaseDate ?? todayIso(),
  });

  const stockInput = h('input', {
    type: 'number',
    id: 'stockAvailable',
    name: 'stockAvailable',
    min: '0',
    step: '1',
    required: true,
    value: String(item?.stockAvailable ?? 0),
  });

  const activeRadio = (value, label) =>
    h(
      'label',
      { class: 'radio' },
      h('input', {
        type: 'radio',
        name: 'active',
        value: String(value),
        checked: (item ? item.active : true) === value,
      }),
      label,
    );

  const statusGroup = h(
    'fieldset',
    { class: 'field field--full', style: { border: 'none', margin: '0', padding: '0' } },
    h('legend', { class: 'field__label' }, 'Status ', h('span', { class: 'field__req' }, '*')),
    h('div', { class: 'radio-row' }, activeRadio(true, 'Active'), activeRadio(false, 'Inactive')),
    h('small', { class: 'field__hint' }, 'Inactive items cannot be selected for new purchases.'),
    h('small', { class: 'field__error', dataset: { errorFor: 'active' } }),
  );

  // `form="item-form"` lets the button live in the card footer, outside <form>.
  const submit = h(
    'button',
    { type: 'submit', class: 'btn btn--primary', form: 'item-form' },
    isEdit ? 'Update Item' : 'Create Item',
  );

  const form = h(
    'form',
    {
      id: 'item-form',
      novalidate: true,
      onSubmit: async (event) => {
        event.preventDefault();
        applyFieldErrors(form, {});

        const payload = {
          name: nameInput.value.trim(),
          itemTypeId: typeSelect.value ? Number(typeSelect.value) : null,
          purchaseDate: dateInput.value,
          stockAvailable: stockInput.value === '' ? null : Number(stockInput.value),
          active: form.querySelector('input[name="active"]:checked')?.value === 'true',
        };

        try {
          await withBusy(submit, 'Saving…', () =>
            isEdit ? api.items.update(item.id, payload) : api.items.create(payload),
          );
          toast(isEdit ? 'Item updated' : 'Item created', 'success');
          navigate(isEdit ? `/items/${item.id}` : '/items');
        } catch (error) {
          applyFieldErrors(form, error.fieldErrors);
          toast(error.message, 'error');
        }
      },
    },
    h(
      'div',
      { class: 'form-grid' },
      field({
        label: 'Item Name',
        name: 'name',
        control: nameInput,
        required: true,
        hint: 'Must be unique.',
      }),
      field({ label: 'Item Type', name: 'itemTypeId', control: typeSelect, required: true }),
      field({ label: 'Purchase Date', name: 'purchaseDate', control: dateInput, required: true }),
      field({
        label: 'Stock Available',
        name: 'stockAvailable',
        control: stockInput,
        required: true,
        hint: 'Whole number, cannot be negative.',
      }),
      statusGroup,
    ),
  );

  render(
    container,
    h(
      'p',
      { class: 'breadcrumb' },
      h('a', { href: '#/items' }, 'Items'),
      ' / ',
      isEdit ? `Edit ${item.name}` : 'Add item',
    ),
    pageHead({
      title: isEdit ? `Edit "${item.name}"` : 'Add Item',
      subtitle: isEdit
        ? 'Stock edited here changes the item master directly. Purchases adjust stock on their own.'
        : 'All fields are validated again on the backend.',
    }),
    card({
      body: form,
      footer: [
        h('a', { class: 'btn', href: isEdit ? `#/items/${item.id}` : '#/items' }, 'Cancel'),
        submit,
      ],
    }),
  );

  nameInput.focus();
}
