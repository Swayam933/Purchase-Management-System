import { api } from '../api.js';
import {
  applyFieldErrors,
  badge,
  card,
  clear,
  confirmDialog,
  emptyState,
  field,
  h,
  pageHead,
  render,
  table,
  toast,
  withBusy,
} from '../ui.js';

/** Item Type Management screen. */
export default async function itemTypesView(container) {
  /** null = create mode, otherwise the type being edited. */
  let editing = null;

  const listSlot = h('div');
  const formSlot = h('div');

  render(
    container,
    pageHead({
      title: 'Item Types',
      subtitle: 'Categories referenced by every item. Stored in their own table.',
    }),
    formSlot,
    listSlot,
  );

  async function refresh() {
    const types = await api.itemTypes.list();
    drawForm();
    drawList(types);
  }

  function drawForm() {
    const input = h('input', {
      type: 'text',
      id: 'typeName',
      name: 'typeName',
      maxlength: '100',
      required: true,
      value: editing?.typeName ?? '',
      placeholder: 'e.g. Electronics',
    });

    const submit = h(
      'button',
      { type: 'submit', class: 'btn btn--primary' },
      editing ? 'Update Item Type' : 'Add Item Type',
    );

    const form = h(
      'form',
      {
        novalidate: true,
        onSubmit: async (event) => {
          event.preventDefault();
          applyFieldErrors(form, {});
          const payload = { typeName: input.value.trim() };

          try {
            await withBusy(submit, 'Saving…', () =>
              editing ? api.itemTypes.update(editing.id, payload) : api.itemTypes.create(payload),
            );
            toast(editing ? 'Item type updated' : 'Item type created', 'success');
            editing = null;
            await refresh();
          } catch (error) {
            applyFieldErrors(form, error.fieldErrors);
            toast(error.message, 'error');
          }
        },
      },
      h(
        'div',
        { class: 'filter-bar' },
        field({
          label: 'Item type name',
          name: 'typeName',
          control: input,
          required: true,
          hint: 'Must be unique.',
        }),
        h(
          'div',
          { class: 'btn-row' },
          submit,
          editing
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'btn',
                  onClick: async () => {
                    editing = null;
                    await refresh();
                  },
                },
                'Cancel',
              )
            : null,
        ),
      ),
    );

    render(
      formSlot,
      card({
        title: editing ? `Edit "${editing.typeName}"` : 'Add Item Type',
        body: form,
      }),
    );

    if (editing) input.focus();
  }

  function drawList(types) {
    clear(listSlot);

    if (types.length === 0) {
      listSlot.append(
        card({
          title: 'All Item Types',
          body: emptyState('No item types yet', 'Add your first category using the form above.'),
          flush: true,
        }),
      );
      return;
    }

    const rows = types.map((type) =>
      h(
        'tr',
        null,
        h('td', { class: 'num mono' }, type.id),
        h('td', null, h('strong', null, type.typeName)),
        h('td', { class: 'num' }, type.itemCount),
        h('td', { class: 'num' }, type.activeItemCount),
        h(
          'td',
          null,
          type.itemCount > 0
            ? badge('In use', 'primary')
            : badge('Unused', 'neutral'),
        ),
        h(
          'td',
          null,
          h(
            'div',
            { class: 'actions' },
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn--sm',
                onClick: async () => {
                  editing = type;
                  drawForm();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                },
              },
              'Edit',
            ),
            h(
              'button',
              {
                type: 'button',
                class: 'btn btn--sm btn--danger',
                disabled: type.itemCount > 0,
                title:
                  type.itemCount > 0
                    ? 'Item types used by items cannot be deleted'
                    : 'Delete this item type',
                onClick: async () => {
                  const confirmed = await confirmDialog({
                    title: 'Delete item type?',
                    message: `"${type.typeName}" will be permanently removed.`,
                    confirmLabel: 'Delete',
                    danger: true,
                  });
                  if (!confirmed) return;

                  try {
                    await api.itemTypes.remove(type.id);
                    toast('Item type deleted', 'success');
                    await refresh();
                  } catch (error) {
                    toast(error.message, 'error');
                  }
                },
              },
              'Delete',
            ),
          ),
        ),
      ),
    );

    listSlot.append(
      card({
        title: 'All Item Types',
        subtitle: `${types.length} type(s)`,
        flush: true,
        body: table({
          columns: [
            { label: 'ID', numeric: true },
            { label: 'Type Name' },
            { label: 'Items', numeric: true },
            { label: 'Active Items', numeric: true },
            { label: 'Usage' },
            { label: 'Actions' },
          ],
          rows,
        }),
      }),
    );
  }

  await refresh();
}
