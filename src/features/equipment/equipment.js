import { fetchItems, updateItem } from '../inventory/inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { createToast } from '../../ui/components.js';

const bodyParts = [
  { value: 'head', label: 'Testa' },
  { value: 'eyes', label: 'Occhi' },
  { value: 'ears', label: 'Orecchie' },
  { value: 'neck', label: 'Collo' },
  { value: 'shoulders', label: 'Spalle' },
  { value: 'back', label: 'Schiena' },
  { value: 'chest', label: 'Torso' },
  { value: 'arms', label: 'Braccia' },
  { value: 'hands', label: 'Mani' },
  { value: 'wrists', label: 'Polsi' },
  { value: 'waist', label: 'Vita' },
  { value: 'legs', label: 'Gambe' },
  { value: 'feet', label: 'Piedi' },
  { value: 'ring', label: 'Dita/Anelli' },
  { value: 'main-hand', label: 'Mano principale' },
  { value: 'off-hand', label: 'Mano secondaria' }
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

  const equippedItems = items.filter((item) => item.equip_slot || item.equipable);
  const attunedCount = items.filter((item) => item.attunement_active).length;

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Equipaggiamento</h2>
        <span class="pill">Attunement attivi: ${attunedCount}</span>
      </header>
      ${bodyParts.map((part) => buildEquipmentSection(part, equippedItems)).join('')}
      ${buildUnassignedSection(equippedItems)}
      ${!equippedItems.length ? '<p class="muted">Nessun oggetto equipaggiato.</p>' : ''}
    </section>
  `;

  container.querySelectorAll('[data-unequip]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = items.find((entry) => entry.id === btn.dataset.unequip);
      if (!item) return;
      try {
        await updateItem(item.id, { equip_slot: null });
        createToast('Equip rimosso');
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

function buildEquipmentSection(part, items) {
  const sectionItems = items.filter((item) => item.equip_slot === part.value);
  if (!sectionItems.length) {
    return `
      <div class="equipment-section">
        <h3>${part.label}</h3>
        <p class="muted">Nessun oggetto.</p>
      </div>
    `;
  }
  return `
    <div class="equipment-section">
      <h3>${part.label}</h3>
      <ul class="inventory-list">
        ${sectionItems.map((item) => `
          <li>
            <div class="item-info">
              ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
              <div>
                <strong>${item.name}</strong>
                <p class="muted">${item.category || 'misc'}</p>
              </div>
            </div>
            <div class="actions">
              <button data-unequip="${item.id}">Rimuovi</button>
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

function buildUnassignedSection(items) {
  const unassigned = items.filter((item) => item.equipable && !item.equip_slot);
  if (!unassigned.length) return '';
  return `
    <div class="equipment-section">
      <h3>Equipaggiabili senza slot</h3>
      <ul class="inventory-list">
        ${unassigned.map((item) => `
          <li>
            <div class="item-info">
              ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
              <div>
                <strong>${item.name}</strong>
                <p class="muted">${item.category || 'misc'}</p>
              </div>
            </div>
            <div class="actions">
              <button data-unequip="${item.id}">Rimuovi</button>
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
