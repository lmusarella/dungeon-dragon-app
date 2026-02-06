import { closeDrawer, openDrawer } from './components.js';
import { getState } from '../app/state.js';

export function renderLayout(container) {
  const baseUrl = import.meta.env.BASE_URL;
  container.innerHTML = `
    <div class="app-shell">
      <header class="app-header" data-app-header>
        <div class="app-header-left">
          <div class="app-logo">
            <img src="${baseUrl}icons/logo_dd.png" alt="Dungeons & Dragons" class="app-logo-image" />
          </div>
          <div>
            <h1>Dungeons & Dragons</h1>
            <p class="app-subtitle">Gestione personaggi</p>
          </div>
        </div>
        <div class="app-header-right">
          <div class="header-meta" data-header-meta>
            <div class="header-meta-item" data-user-row>
              <div class="header-avatar" data-user-avatar></div>
              <div class="header-meta-text">
                <span class="header-meta-label">Utente</span>
                <strong data-user-name></strong>
              </div>
            </div>
            <div class="header-meta-item" data-character-row>
              <div class="header-avatar" data-character-avatar></div>
              <div class="header-meta-text">
                <span class="header-meta-label">Personaggio</span>
                <strong data-character-name></strong>
              </div>
            </div>
          </div>
          <button class="menu-button" type="button" data-menu-button aria-label="Apri menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>
      <div class="offline-banner" data-offline-banner hidden>
        Offline (solo lettura)
      </div>
      <main class="app-main" data-route-outlet></main>
      <div class="actions-fab" data-actions-fab>
        <div class="actions-fab-menu" data-actions-menu>
          <button class="actions-fab-item" type="button" data-rest="short_rest">Riposo Breve</button>
          <button class="actions-fab-item" type="button" data-add-loot>Loot</button>
          <button class="actions-fab-item" type="button" data-money-action="pay" data-fab-scope="inventory">Paga</button>
          <button class="actions-fab-item" type="button" data-money-action="receive" data-fab-scope="inventory">Ricevi</button>
          <button class="actions-fab-item" type="button" data-hp-action="heal">Cura</button>
          <button class="actions-fab-item" type="button" data-hp-action="damage">Danno</button>
          <button class="actions-fab-item" type="button" data-edit-conditions data-fab-scope="home">Condizioni</button>
          <button class="actions-fab-item" type="button" data-open-dice="roller">Dadi</button>
          <button class="actions-fab-item" type="button" data-rest="long_rest">Riposo Lungo</button>
        </div>
        <button class="actions-fab-toggle" type="button" data-actions-toggle aria-expanded="false">
          Azioni
        </button>
      </div>
      <div class="actions-fab-backdrop" aria-hidden="true"></div>
      <nav class="bottom-nav" data-bottom-nav>
        <a href="#/home" data-tab="home">Scheda Personaggio</a>
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
          <div class="modal-header">
            <p class="eyebrow modal-title" data-confirm-title>Conferma</p>
            <div class="modal-divider" aria-hidden="true"></div>
          </div>
          <div class="modal-body">
            <p class="eyebrow" data-confirm-message></p>
          </div>
          <div class="modal-footer">
            <div class="modal-divider" aria-hidden="true"></div>
            <div class="modal-actions">
              <div class="modal-actions__left">
                <button class="ghost-button" data-confirm-cancel>Annulla</button>
              </div>
              <div class="modal-actions__right">
                <button class="primary" data-confirm-ok>Conferma</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal" data-form-modal hidden>
        <div class="modal-overlay" data-form-overlay></div>
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-header">
            <p class="eyebrow modal-title" data-form-title>Inserisci dati</p>
            <div class="modal-divider" aria-hidden="true"></div>
          </div>
          <form data-form-body class="modal-form">
            <div class="modal-body" data-form-fields></div>
            <div class="modal-footer">
              <div class="modal-divider" aria-hidden="true"></div>
              <div class="modal-actions">
                <div class="modal-actions__left">
                  <button class="ghost-button" type="button" data-form-cancel>Annulla</button>
                </div>
                <div class="modal-actions__right">
                  <button class="primary" type="submit" data-form-submit>Conferma</button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      <div class="toast-container" data-toast-container></div>
    </div>
  `;

  container.querySelectorAll('[data-drawer-close]')
    .forEach((btn) => btn.addEventListener('click', closeDrawer));

  const menuButton = container.querySelector('[data-menu-button]');
  if (menuButton) {
    menuButton.addEventListener('click', () => {
      openDrawer(buildMenuContent());
    });
  }

  const actionsFab = container.querySelector('[data-actions-fab]');
  const actionsToggle = container.querySelector('[data-actions-toggle]');
  if (actionsFab && actionsToggle) {
    actionsToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      actionsFab.classList.toggle('is-open');
      actionsToggle.setAttribute('aria-expanded', actionsFab.classList.contains('is-open'));
    });
  }

  container.addEventListener('click', (event) => {
    const target = event.target.closest('[data-drawer-close]');
    if (target) {
      closeDrawer();
    }
    if (actionsFab && actionsFab.classList.contains('is-open')) {
      const insideFab = event.target.closest('[data-actions-fab]');
      if (!insideFab) {
        actionsFab.classList.remove('is-open');
        actionsToggle?.setAttribute('aria-expanded', 'false');
      }
    }
  });
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
  const route = window.location.hash.replace('#/', '') || 'home';
  banner.hidden = route === 'login' || !offline;
}

export function updateHeaderInfo() {
  const headerMeta = document.querySelector('[data-header-meta]');
  const menuButton = document.querySelector('[data-menu-button]');
  if (!headerMeta) return;
  const { user, characters, activeCharacterId } = getState();
  const activeCharacter = characters.find((char) => char.id === activeCharacterId);
  const userRow = headerMeta.querySelector('[data-user-row]');
  const characterRow = headerMeta.querySelector('[data-character-row]');
  const userNameEl = headerMeta.querySelector('[data-user-name]');
  const characterNameEl = headerMeta.querySelector('[data-character-name]');
  const userAvatarEl = headerMeta.querySelector('[data-user-avatar]');
  const characterAvatarEl = headerMeta.querySelector('[data-character-avatar]');

  const userName = user?.user_metadata?.display_name || user?.email || 'Utente';
  if (userRow) {
    userRow.hidden = !user;
  }
  if (userNameEl) {
    userNameEl.textContent = user ? userName : '';
  }
  if (userAvatarEl) {
    renderAvatar(userAvatarEl, userName, user?.user_metadata?.avatar_url);
  }

  if (characterRow) {
    characterRow.hidden = !activeCharacter;
  }
  if (characterNameEl) {
    characterNameEl.textContent = activeCharacter?.name ?? '';
  }
  if (characterAvatarEl) {
    renderAvatar(characterAvatarEl, activeCharacter?.name, activeCharacter?.data?.avatar_url);
  }

  headerMeta.hidden = !user;
  if (menuButton) {
    menuButton.hidden = !user;
  }
}

function buildMenuContent() {
  const wrapper = document.createElement('div');
  wrapper.className = 'menu-list';
  wrapper.innerHTML = `
    <h2>Menu</h2>
    <a class="menu-item" href="#/characters" data-drawer-close>Seleziona personaggi</a>
    <button class="menu-item menu-item--danger" type="button" data-logout data-drawer-close>Logout</button>
  `;
  return wrapper;
}

function renderAvatar(container, name, imageUrl) {
  container.innerHTML = '';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = name ? `Avatar di ${name}` : 'Avatar';
    container.appendChild(img);
    return;
  }
  const initials = getInitials(name);
  const fallback = document.createElement('span');
  fallback.textContent = initials;
  container.appendChild(fallback);
}

function getInitials(name = '') {
  const parts = name.split(' ').filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
