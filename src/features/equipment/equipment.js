import { fetchItems, updateItem } from '../inventory/inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { createToast } from '../../ui/components.js';

const states = [
  { value: 'equipped', label: 'Equipaggiato' },
  { value: 'worn', label: 'Indossato' },
  { value: 'held', label: 'Impugnato' }
];

export async function renderEquipment(container) {
  const state = getState();
  const activeCharacter = state.characters.find((char) => char.id === state.activeCharacterId);
  if (!activeCharacter) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  let items = state.cache.items;
  if (!state.offline) {
    try {
      items = await fetchItems(activeCharacter.id);
      updateCache('items', items);
      await cacheSnapshot({ items });
    } catch (error) {
      createToast('Errore caricamento equip', 'error');
    }
  }

  const equippedItems = items.filter((item) => item.equipped_state && item.equipped_state !== 'none');
  const attunedCount = items.filter((item) => item.attunement_active).length;

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Equipaggiamento</h2>
        <span class="pill">Attunement attivi: ${attunedCount}</span>
      </header>
      ${states.map((state) => buildEquipmentSection(state, equippedItems)).join('')}
      ${!equippedItems.length ? '<p class="muted">Nessun oggetto equipaggiato.</p>' : ''}
    </section>
  `;

  container.querySelectorAll('[data-toggle]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = items.find((entry) => entry.id === btn.dataset.toggle);
      if (!item) return;
      const nextState = btn.dataset.state;
      try {
        await updateItem(item.id, { equipped_state: nextState });
        createToast('Aggiornato');
        renderEquipment(container);
      } catch (error) {
        createToast('Errore aggiornamento', 'error');
      }
    }));

  container.querySelectorAll('[data-attune]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = items.find((entry) => entry.id === btn.dataset.attune);
      if (!item) return;
      try {
        await updateItem(item.id, { attunement_active: !item.attunement_active });
        createToast('Attunement aggiornato');
        renderEquipment(container);
      } catch (error) {
        createToast('Errore attunement', 'error');
      }
    }));
}

function buildEquipmentSection(state, items) {
  const sectionItems = items.filter((item) => item.equipped_state === state.value);
  if (!sectionItems.length) {
    return `
      <div class="equipment-section">
        <h3>${state.label}</h3>
        <p class="muted">Nessun oggetto.</p>
      </div>
    `;
  }
  return `
    <div class="equipment-section">
      <h3>${state.label}</h3>
      <ul class="inventory-list">
        ${sectionItems.map((item) => `
          <li>
            <div>
              <strong>${item.name}</strong>
              <p class="muted">${item.category || 'misc'}</p>
            </div>
            <div class="actions">
              <button data-toggle="${item.id}" data-state="none">Rimuovi</button>
              <button data-attune="${item.id}">
                ${item.attunement_active ? 'Disattiva attune' : 'Attiva attune'}
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}
