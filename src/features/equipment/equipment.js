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
  const slotSummary = bodyParts.map((part) => ({
    ...part,
    items: equippedItems.filter((item) => item.equip_slot === part.value)
  }));
  const occupiedSlots = slotSummary.filter((slot) => slot.items.length).length;

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Equipaggiamento</h2>
        <span class="pill">Sintonie attive: ${attunedCount}</span>
      </header>
      <div class="equipment-layout">
        ${buildEquipmentDoll(slotSummary, occupiedSlots)}
        ${buildEquipmentSlotList(slotSummary)}
      </div>
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
        createToast('Sintonia aggiornata');
        renderEquipment(container);
      } catch (error) {
        createToast('Errore attunement', 'error');
      }
    }));
}

function buildEquipmentDoll(slotSummary, occupiedSlots) {
  return `
    <div class="equipment-doll">
      <div class="equipment-doll-header">
        <h3>Manichino</h3>
        <span class="muted">${occupiedSlots}/${slotSummary.length} slot occupati</span>
      </div>
      <div class="equipment-doll-grid">
        ${slotSummary.map((slot) => {
    const firstItem = slot.items[0];
    return `
          <div class="doll-slot doll-slot--${slot.value} ${slot.items.length ? 'is-filled' : ''}">
            <span class="doll-slot-label">${slot.label}</span>
            <span class="doll-slot-item">${firstItem ? firstItem.name : 'Libero'}</span>
            ${slot.items.length > 1 ? `<span class="doll-slot-count">+${slot.items.length - 1}</span>` : ''}
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}

function buildEquipmentSlotList(slotSummary) {
  return `
    <div class="equipment-slot-list">
      ${slotSummary.map((slot) => `
        <div class="equipment-slot-card">
          <div class="equipment-slot-card-header">
            <h3>${slot.label}</h3>
            <span class="pill">${slot.items.length ? 'Occupato' : 'Libero'}</span>
          </div>
          ${slot.items.length
    ? slot.items.map((item) => `
              <div class="equipment-slot-item">
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
              </div>
            `).join('')
    : '<div class="equipment-slot-item empty">Slot libero</div>'}
        </div>
      `).join('')}
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
