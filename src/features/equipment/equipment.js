import { fetchItems, updateItem } from '../inventory/inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { createToast } from '../../ui/components.js';

const bodyParts = [
  { value: 'head', label: 'Testa' },
  { value: 'eyes-left', label: 'Occhio sinistro' },
  { value: 'eyes-right', label: 'Occhio destro' },
  { value: 'ears-left', label: 'Orecchio sinistro' },
  { value: 'ears-right', label: 'Orecchio destro' },
  { value: 'neck', label: 'Collo' },
  { value: 'shoulder-left', label: 'Spalla sinistra' },
  { value: 'shoulder-right', label: 'Spalla destra' },
  { value: 'back', label: 'Schiena' },
  { value: 'chest', label: 'Torso' },
  { value: 'arm-left', label: 'Braccio sinistro' },
  { value: 'arm-right', label: 'Braccio destro' },
  { value: 'hand-left', label: 'Mano sinistra' },
  { value: 'hand-right', label: 'Mano destra' },
  { value: 'wrist-left', label: 'Polso sinistro' },
  { value: 'wrist-right', label: 'Polso destro' },
  { value: 'waist', label: 'Vita' },
  { value: 'leg-left', label: 'Gamba sinistra' },
  { value: 'leg-right', label: 'Gamba destra' },
  { value: 'foot-left', label: 'Piede sinistro' },
  { value: 'foot-right', label: 'Piede destro' },
  { value: 'ring-left', label: 'Dita/Anello sinistro' },
  { value: 'ring-right', label: 'Dita/Anello destro' },
  { value: 'main-hand', label: 'Mano principale' },
  { value: 'off-hand', label: 'Mano secondaria' },
  { value: 'eyes', label: 'Occhi (generico)' },
  { value: 'ears', label: 'Orecchie (generico)' },
  { value: 'shoulders', label: 'Spalle (generico)' },
  { value: 'arms', label: 'Braccia (generico)' },
  { value: 'hands', label: 'Mani (generico)' },
  { value: 'wrists', label: 'Polsi (generico)' },
  { value: 'legs', label: 'Gambe (generico)' },
  { value: 'feet', label: 'Piedi (generico)' },
  { value: 'ring', label: 'Dita/Anelli (generico)' }
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

  const equippedItems = items.filter((item) => getEquipSlots(item).length || item.equipable);
  const attunedCount = items.filter((item) => item.attunement_active).length;
  const slotSummary = bodyParts.map((part) => ({
    ...part,
    items: equippedItems.filter((item) => getEquipSlots(item).includes(part.value))
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

  const dollSlots = Array.from(container.querySelectorAll('[data-doll-slot]'));
  const slotCards = Array.from(container.querySelectorAll('[data-slot-card]'));

  const updateSelection = (slotValue) => {
    dollSlots.forEach((slot) => {
      const isSelected = slot.dataset.dollSlot === slotValue;
      slot.classList.toggle('is-selected', isSelected);
      slot.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });
    slotCards.forEach((card) => {
      card.classList.toggle('is-selected', card.dataset.slotCard === slotValue);
    });
  };

  dollSlots.forEach((slot) => {
    slot.addEventListener('click', () => {
      const nextValue = slot.classList.contains('is-selected') ? null : slot.dataset.dollSlot;
      updateSelection(nextValue);
    });
  });

  container.querySelectorAll('[data-unequip]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = items.find((entry) => entry.id === btn.dataset.unequip);
      if (!item) return;
      try {
        await updateItem(item.id, { equip_slot: null, equip_slots: [] });
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
          <button type="button" class="doll-slot doll-slot--${slot.value} ${slot.items.length ? 'is-filled' : ''}" data-doll-slot="${slot.value}" aria-pressed="false">
            <span class="doll-slot-label">${slot.label}</span>
            <span class="doll-slot-item">${firstItem ? firstItem.name : 'Libero'}</span>
            ${slot.items.length > 1 ? `<span class="doll-slot-count">+${slot.items.length - 1}</span>` : ''}
          </button>
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
        <div class="equipment-slot-card" data-slot-card="${slot.value}">
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
                    <p class="muted">${item.category || 'misc'}${item.sovrapponibile ? ' · sovrapponibile' : ''}</p>
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
  const unassigned = items.filter((item) => item.equipable && !getEquipSlots(item).length);
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
                <p class="muted">${item.category || 'misc'}${item.sovrapponibile ? ' · sovrapponibile' : ''}</p>
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

function getEquipSlots(item) {
  if (!item) return [];
  if (Array.isArray(item.equip_slots)) {
    return item.equip_slots.filter(Boolean);
  }
  if (typeof item.equip_slots === 'string' && item.equip_slots.trim()) {
    try {
      const parsed = JSON.parse(item.equip_slots);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (error) {
      return [item.equip_slots];
    }
  }
  if (item.equip_slot) return [item.equip_slot];
  return [];
}
