import './styles/base.css';
import './styles/theme.css';
import { renderLayout, updateHeaderInfo, updateOfflineBanner } from './ui/layout.js';
import { initRouter, registerRoute } from './app/router.js';
import { initSession, ensureProfile, signOut } from './app/session.js';
import { getState, setState, subscribe } from './app/state.js';
import { renderLogin } from './features/auth/login.js';
import { renderHome } from './features/character/home.js';
import { renderCharacterSelect } from './features/character/select.js';
import { renderInventory } from './features/inventory/inventory.js';
import { renderJournal } from './features/journal/journal.js';
import { renderSettings } from './features/character/settings.js';
import { loadCachedData } from './lib/offline/cache.js';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector('#app');
renderLayout(app);

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-logout]');
  if (target) {
    event.preventDefault();
    await signOut();
  }
});

registerRoute('login', renderLogin);
registerRoute('home', renderHome);
registerRoute('characters', renderCharacterSelect);
registerRoute('inventory', renderInventory);
registerRoute('journal', renderJournal);
registerRoute('settings', renderSettings);

subscribe(() => {
  updateOfflineBanner();
  updateHeaderInfo();
});

window.addEventListener('online', () => setState({ offline: false }));
window.addEventListener('offline', () => setState({ offline: true }));
setState({ offline: !navigator.onLine });

await initSession();
const { user } = getState();
if (user) {
  await ensureProfile(user);
}
updateHeaderInfo();

await loadCachedData();
initRouter();

registerSW({ immediate: true });
