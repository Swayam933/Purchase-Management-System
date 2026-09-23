import { route, start, navigate } from './router.js';
import { render, loading, notice, emptyState, link } from './ui.js';

import itemTypesView from './views/itemTypes.js';
import itemsView from './views/items.js';
import itemFormView from './views/itemForm.js';
import itemDetailsView from './views/itemDetails.js';
import purchasesView from './views/purchases.js';
import purchaseFormView from './views/purchaseForm.js';
import purchaseDetailsView from './views/purchaseDetails.js';
import stockView from './views/stock.js';

const main = document.getElementById('main');

function setActiveNav(path) {
  for (const anchor of document.querySelectorAll('[data-nav]')) {
    const base = anchor.dataset.nav;
    const isActive = path === base || path.startsWith(`${base}/`);
    if (isActive) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');
  }
}

/** Wraps a view so loading state and unexpected failures are handled once. */
const mount = (view) => async (params) => {
  render(main, loading());
  try {
    await view(main, params);
  } catch (error) {
    console.error(error);
    render(
      main,
      notice(error?.message ?? 'Something went wrong', 'error'),
      link('#/items', 'Back to items', 'btn'),
    );
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
};

/* Registration order matters: literal paths before parameterised ones. */
route('/', () => navigate('/items', { replace: true }));
route('/item-types', mount(itemTypesView));

route('/items', mount(itemsView));
route('/items/new', mount((container) => itemFormView(container, { mode: 'create' })));
route('/items/:id/edit', mount((container, params) => itemFormView(container, { mode: 'edit', id: params.id })));
route('/items/:id', mount(itemDetailsView));

route('/purchases', mount(purchasesView));
route('/purchases/new', mount((container) => purchaseFormView(container, { mode: 'create' })));
route('/purchases/:id/edit', mount((container, params) => purchaseFormView(container, { mode: 'edit', id: params.id })));
route('/purchases/:id', mount(purchaseDetailsView));

route('/stock', mount(stockView));

start({
  resolve: (path) => setActiveNav(path),
  notFound: (path) =>
    render(
      main,
      emptyState(
        'Page not found',
        `No screen matches "${path}".`,
        link('#/items', 'Go to items', 'btn btn--primary'),
      ),
    ),
});
