/**
 * DOM helpers.
 *
 * Views build elements through `h()` instead of assigning innerHTML, so any
 * value coming from the API is inserted as text and can never be interpreted as
 * markup.
 */

const BOOLEAN_PROPS = new Set([
  'checked',
  'disabled',
  'selected',
  'required',
  'readOnly',
  'autofocus',
  'multiple',
  'open',
]);

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Tiny hyperscript: h('div', { class: 'card' }, 'text', otherNode). */
export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'style') Object.assign(el.style, value);
    else if (key === 'value') el.value = value;
    else if (BOOLEAN_PROPS.has(key)) el[key] = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else el.setAttribute(key, String(value));
  }

  append(el, children);
  return el;
}

export function fragment(...children) {
  const frag = document.createDocumentFragment();
  append(frag, children);
  return frag;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function render(container, ...children) {
  clear(container);
  append(container, children);
  return container;
}

/* ------------------------------------------------------------------ dates */

/** `2026-08-25` -> `25-08-2026` (the display format used in the assignment). */
export function formatDate(iso) {
  if (!iso) return '—';
  const [year, month, day] = String(iso).slice(0, 10).split('-');
  return year && month && day ? `${day}-${month}-${year}` : String(iso);
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return `${formatDate(date.toISOString())} ${date.toTimeString().slice(0, 5)}`;
}

export function todayIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

/* ----------------------------------------------------------------- badges */

export const badge = (text, variant = 'neutral') => h('span', { class: `badge badge--${variant}` }, text);

const AVAILABILITY_VARIANT = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
};

export const availabilityBadge = (availability) =>
  badge(availability?.label ?? '—', AVAILABILITY_VARIANT[availability?.status] ?? 'neutral');

export const statusBadge = (active) =>
  badge(active ? 'Active' : 'Inactive', active ? 'primary' : 'neutral');

/* ----------------------------------------------------------------- blocks */

export const pageHead = ({ title, subtitle, actions = [] }) =>
  h(
    'div',
    { class: 'page-head' },
    h(
      'div',
      { class: 'page-head__text' },
      h('h1', null, title),
      subtitle ? h('p', null, subtitle) : null,
    ),
    actions.length ? h('div', { class: 'page-head__actions' }, ...actions) : null,
  );

export const card = ({ title, subtitle, actions = [], body, footer, flush = false }) =>
  h(
    'section',
    { class: 'card' },
    title
      ? h(
          'div',
          { class: 'card__head' },
          h('div', null, h('h2', null, title), subtitle ? h('p', null, subtitle) : null),
          actions.length ? h('div', { class: 'btn-row' }, ...actions) : null,
        )
      : null,
    h('div', { class: `card__body${flush ? ' card__body--flush' : ''}` }, body),
    footer ? h('div', { class: 'card__foot' }, footer) : null,
  );

export const notice = (message, variant = 'info', items = []) =>
  h(
    'div',
    { class: `notice notice--${variant}`, role: variant === 'error' ? 'alert' : undefined },
    h(
      'div',
      { class: 'notice__body' },
      h('strong', null, message),
      items.length
        ? h('ul', null, ...items.map((item) => h('li', null, item)))
        : null,
    ),
  );

export const emptyState = (title, message, action = null) =>
  h('div', { class: 'empty' }, h('h3', null, title), message ? h('p', null, message) : null, action);

export const loading = (message = 'Loading…') => h('p', { class: 'loading' }, message);

export const link = (href, text, className = 'btn btn--sm') => h('a', { class: className, href }, text);

/** Labelled form control with a reserved slot for its validation message. */
export function field({ label, control, name, hint, required = false, full = false }) {
  const errorId = `${name}-error`;
  control.setAttribute('aria-describedby', errorId);
  return h(
    'div',
    { class: `field${full ? ' field--full' : ''}` },
    h(
      'label',
      { for: control.id || name },
      label,
      required ? h('span', { class: 'field__req', 'aria-hidden': 'true' }, '*') : null,
    ),
    control,
    hint ? h('small', { class: 'field__hint' }, hint) : null,
    h('small', { class: 'field__error', id: errorId, dataset: { errorFor: name } }),
  );
}

/** Paints backend validation details onto the matching inputs. */
export function applyFieldErrors(root, fieldErrors = {}) {
  root.querySelectorAll('[data-error-for]').forEach((slot) => {
    slot.textContent = '';
    const input = root.querySelector(`[name="${slot.dataset.errorFor}"]`);
    input?.removeAttribute('aria-invalid');
  });

  let firstInvalid = null;
  for (const [name, message] of Object.entries(fieldErrors)) {
    const slot = root.querySelector(`[data-error-for="${name}"]`);
    if (slot) slot.textContent = message;
    const input = root.querySelector(`[name="${name}"]`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      firstInvalid ??= input;
    }
  }
  firstInvalid?.focus();
}

export const table = ({ columns, rows, caption, footer }) =>
  h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      null,
      caption ? h('caption', null, caption) : null,
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ...columns.map((column) =>
            h('th', { scope: 'col', class: column.numeric ? 'num' : undefined }, column.label),
          ),
        ),
      ),
      h('tbody', null, ...rows),
      footer ? h('tfoot', null, footer) : null,
    ),
  );

/* ----------------------------------------------------------------- toasts */

export function toast(message, variant = 'info', timeout = 4200) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const node = h('div', { class: `toast toast--${variant}` }, message);
  region.append(node);
  setTimeout(() => node.remove(), timeout);
}

/* ---------------------------------------------------------------- confirm */

/** Accessible confirm dialog. Resolves true when the action is confirmed. */
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      dialog.close();
    };

    const confirmButton = h(
      'button',
      { type: 'button', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => finish(true) },
      confirmLabel,
    );

    const dialog = h(
      'dialog',
      { 'aria-labelledby': 'confirm-title' },
      h(
        'div',
        { class: 'dialog__body' },
        h('h2', { id: 'confirm-title' }, title),
        h('p', null, message),
      ),
      h(
        'div',
        { class: 'dialog__foot' },
        h('button', { type: 'button', class: 'btn', onClick: () => finish(false) }, cancelLabel),
        confirmButton,
      ),
    );

    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('close', () => {
      finish(false);
      dialog.remove();
    });

    document.body.append(dialog);
    dialog.showModal();
    confirmButton.focus();
  });
}

/** Disables a submit button while an async action is in flight. */
export async function withBusy(button, label, action) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
