import { updateActiveTab } from '../ui/layout.js';
import { getState } from './state.js';

const routes = new Map();

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function navigate(path) {
  window.location.hash = `#/${path}`;
}

export function initRouter() {
  window.addEventListener('hashchange', () => renderRoute());
  renderRoute();
}

function renderRoute() {
  const outlet = document.querySelector('[data-route-outlet]');
  if (!outlet) return;
  const route = window.location.hash.replace('#/', '') || 'home';
  const { user } = getState();
  if (!user && route !== 'login') {
    window.location.hash = '#/login';
    return;
  }
  if (user && route === 'login') {
    window.location.hash = '#/home';
    return;
  }
  const view = routes.get(route) || routes.get('home');
  outlet.innerHTML = '';
  updateActiveTab(route);
  const bottomNav = document.querySelector('[data-bottom-nav]');
  const actionsFab = document.querySelector('[data-actions-fab]');
  const hideFooter = route === 'login' || route === 'characters';
  const showFab = route === 'home' || route === 'inventory';
  if (bottomNav) bottomNav.hidden = hideFooter;
  if (actionsFab) {
    actionsFab.hidden = !showFab;
    actionsFab.classList.remove('is-open');
  }
  view?.(outlet);
}
