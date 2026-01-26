import './styles/base.css';
import './styles/theme.css';
import { renderLayout, updateOfflineBanner } from './ui/layout.js';
import { initRouter, registerRoute } from './app/router.js';
import { initSession, ensureProfile, signOut } from './app/session.js';
import { getState, setState, subscribe } from './app/state.js';
import { renderLogin } from './features/auth/login.js';
import { renderHome } from './features/character/home.js';
import { renderInventory } from './features/inventory/inventory.js';
import { renderJournal } from './features/journal/journal.js';
import { renderSettings } from './features/character/settings.js';
import { loadCachedData } from './lib/offline/cache.js';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector('#app');
renderLayout(app);

const logoutButton = document.querySelector('[data-logout]');
if (logoutButton) {
  logoutButton.addEventListener('click', async () => {
    await signOut();
  });
}
const updateAuthActions = () => {
  const { user } = getState();
  if (logoutButton) logoutButton.hidden = !user;
};
updateAuthActions();

registerRoute('login', renderLogin);
registerRoute('home', renderHome);
registerRoute('inventory', renderInventory);
registerRoute('journal', renderJournal);
registerRoute('settings', renderSettings);

subscribe(() => {
  updateOfflineBanner();
  updateAuthActions();
});

window.addEventListener('online', () => setState({ offline: false }));
window.addEventListener('offline', () => setState({ offline: true }));
setState({ offline: !navigator.onLine });

await initSession();
const { user } = getState();
if (user) {
  await ensureProfile(user);
}

await loadCachedData();
initRouter();

registerSW({ immediate: true });
