import './styles/base.css';
import './styles/theme.css';
import { renderLayout, updateOfflineBanner } from './ui/layout.js';
import { initRouter, registerRoute } from './app/router.js';
import { initSession, ensureProfile } from './app/session.js';
import { getState, setState, subscribe } from './app/state.js';
import { renderLogin } from './features/auth/login.js';
import { renderHome } from './features/character/home.js';
import { renderInventory } from './features/inventory/inventory.js';
import { renderEquipment } from './features/equipment/equipment.js';
import { renderJournal } from './features/journal/journal.js';
import { renderActions } from './features/actions/actions.js';
import { renderSettings } from './features/character/settings.js';
import { loadCachedData } from './lib/offline/cache.js';
import { registerSW } from 'virtual:pwa-register';

const app = document.querySelector('#app');
renderLayout(app);

registerRoute('login', renderLogin);
registerRoute('home', renderHome);
registerRoute('inventory', renderInventory);
registerRoute('equipment', renderEquipment);
registerRoute('journal', renderJournal);
registerRoute('actions', renderActions);
registerRoute('settings', renderSettings);

subscribe(() => {
  updateOfflineBanner();
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
