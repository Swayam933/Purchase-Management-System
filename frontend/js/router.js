/**
 * Hash based router.
 *
 * Hash routing keeps the SPA working from any static host without server side
 * rewrite rules.
 */

const routes = [];

function compile(path) {
  const keys = [];
  const pattern = path.replace(/:[A-Za-z0-9_]+/g, (match) => {
    keys.push(match.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), keys };
}

/** Registration order matters: `/items/new` must be added before `/items/:id`. */
export function route(path, handler) {
  routes.push({ path, handler, ...compile(path) });
}

export const currentPath = () => {
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
};

export const navigate = (path, { replace = false } = {}) => {
  const target = `#${path}`;
  if (replace) window.location.replace(target);
  else window.location.hash = path;
};

function match(path) {
  for (const entry of routes) {
    const result = entry.regex.exec(path);
    if (!result) continue;
    const params = Object.fromEntries(
      entry.keys.map((key, index) => [key, decodeURIComponent(result[index + 1])]),
    );
    return { entry, params };
  }
  return null;
}

let onResolve = null;
let notFoundHandler = null;

export function start({ resolve, notFound }) {
  onResolve = resolve;
  notFoundHandler = notFound;
  window.addEventListener('hashchange', dispatch);
  dispatch();
}

async function dispatch() {
  const path = currentPath();
  const found = match(path);
  await onResolve?.(path);

  if (!found) {
    await notFoundHandler?.(path);
    return;
  }
  await found.entry.handler(found.params);
}
