import { closeDrawer } from './components.js';
import { getState } from '../app/state.js';

export function renderLayout(container) {
  container.innerHTML = `
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>Dungeon Dragon</h1>
          <p class="app-subtitle">Gestione personaggi D&D</p>
        </div>
        <div class="header-actions">
          <a href="#/settings" class="ghost-button">Impostazioni</a>
          <button class="ghost-button" type="button" data-logout>Logout</button>
        </div>
      </header>
      <div class="offline-banner" data-offline-banner hidden>
        Offline (solo lettura)
      </div>
      <main class="app-main" data-route-outlet></main>
      <nav class="bottom-nav" data-bottom-nav>
        <a href="#/home" data-tab="home">Home</a>
        <a href="#/inventory" data-tab="inventory">Inventario</a>
        <a href="#/journal" data-tab="journal">Diario</a>
      </nav>
      <div class="drawer" data-drawer>
        <div class="drawer-overlay" data-drawer-close></div>
        <div class="drawer-panel">
          <button class="drawer-close" data-drawer-close>Chiudi</button>
          <div data-drawer-body></div>
        </div>
      </div>
      <div class="modal" data-confirm-modal hidden>
        <div class="modal-overlay" data-confirm-overlay></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <h3 data-confirm-title>Conferma</h3>
          <p data-confirm-message></p>
          <div class="modal-actions">
            <button class="ghost-button" data-confirm-cancel>Annulla</button>
            <button class="primary" data-confirm-ok>Conferma</button>
          </div>
        </div>
      </div>
      <div class="modal" data-form-modal hidden>
        <div class="modal-overlay" data-form-overlay></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <h3 data-form-title>Inserisci dati</h3>
          <form data-form-body>
            <div data-form-fields></div>
            <div class="modal-actions">
              <button class="ghost-button" type="button" data-form-cancel>Annulla</button>
              <button class="primary" type="submit" data-form-submit>Conferma</button>
            </div>
          </form>
        </div>
      </div>
      <div class="toast-container" data-toast-container></div>
    </div>
  `;

  container.querySelectorAll('[data-drawer-close]')
    .forEach((btn) => btn.addEventListener('click', closeDrawer));
}

export function updateActiveTab(route) {
  document.querySelectorAll('[data-bottom-nav] a').forEach((link) => {
    const isActive = link.getAttribute('href') === `#/${route}`;
    link.classList.toggle('active', isActive);
  });
}

export function updateOfflineBanner() {
  const banner = document.querySelector('[data-offline-banner]');
  if (!banner) return;
  const { offline } = getState();
  banner.hidden = !offline;
}
