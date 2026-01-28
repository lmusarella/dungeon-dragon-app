import { fetchItems, createItem, updateItem, deleteItem } from './inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { applyMoneyDelta, calcTotalWeight } from '../../lib/calc.js';
import { formatCoin, formatWeight } from '../../lib/format.js';
import { buildInput, buildTextarea, createToast, buildSelect, openConfirmModal, openFormModal } from '../../ui/components.js';
import { fetchWallet, upsertWallet, createTransaction, fetchTransactions } from '../wallet/walletApi.js';
import { renderWalletSummary } from '../wallet/wallet.js';

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

const itemCategories = [
  { value: 'gear', label: 'Equipaggiamento', equipable: true },
  { value: 'loot', label: 'Loot' },
  { value: 'consumable', label: 'Consumabili' },
  { value: 'weapon', label: 'Armi', equipable: true },
  { value: 'armor', label: 'Armature', equipable: true },
  { value: 'magic', label: 'Magici', equipable: true },
  { value: 'jewelry', label: 'Gioielli e ornamenti', equipable: true },
  { value: 'tool', label: 'Strumenti' },
  { value: 'container', label: 'Contenitore' },
  { value: 'misc', label: 'Altro' }
];

const categories = [
  { value: '', label: 'Tutte' },
  ...itemCategories
];

const categoryLabels = new Map(itemCategories.map((category) => [category.value, category.label]));
const bodyPartLabels = new Map(bodyParts.map((part) => [part.value, part.label]));
const weaponTypes = [
  { value: '', label: 'Seleziona' },
  { value: 'simple', label: 'Semplice' },
  { value: 'martial', label: 'Da guerra' }
];
const armorTypes = [
  { value: '', label: 'Seleziona' },
  { value: 'light', label: 'Leggera' },
  { value: 'medium', label: 'Media' },
  { value: 'heavy', label: 'Pesante' }
];

export async function renderInventory(container) {
  const state = getState();
  const activeCharacter = state.characters.find((char) => char.id === state.activeCharacterId);
  if (!activeCharacter) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  let items = state.cache.items;
  let wallet = state.cache.wallet;
  if (!state.offline) {
    try {
      items = await fetchItems(activeCharacter.id);
      updateCache('items', items);
      await cacheSnapshot({ items });
    } catch (error) {
      createToast('Errore caricamento inventario', 'error');
    }
    try {
      wallet = await fetchWallet(activeCharacter.id);
      updateCache('wallet', wallet);
      if (wallet) await cacheSnapshot({ wallet });
    } catch (error) {
      createToast('Errore caricamento wallet', 'error');
    }
  }

  const totalWeight = calcTotalWeight(items);
  const weightUnit = getWeightUnit(activeCharacter);
  const weightStep = weightUnit === 'kg' ? '0.1' : '1';
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
        <span class="pill">Slot Sintonia Attivi: ${attunedCount}</span>
      </header>
      <div class="equipment-layout" data-equipment-list>
        ${buildEquipmentDoll(slotSummary, occupiedSlots)}
        ${buildEquipmentSlotList(slotSummary)}
      </div>
      ${buildUnassignedSection(equippedItems)}
      ${!equippedItems.length ? '<p class="muted">Nessun oggetto equipaggiato.</p>' : ''}
    </section>
     <section class="card compact-card">
      <div class="compact-grid">
        <div class="compact-panel">
          <header class="compact-header">
            <h3>Monete</h3>
          </header>
          ${renderWalletSummary(wallet)}       
          <div class="compact-action-grid">
            <button class="primary" type="button" data-money-action="pay">Paga</button>
            <button class="primary" type="button" data-money-action="receive">Ricevi</button>
            <button type="button" data-view-transactions>Transazioni</button>
          </div>
        </div>
      </div>
    </section>
    <section class="card">
      <header class="card-header">
        <h2>Inventario</h2>
        <div class="button-row">
          <button class="primary" type="button" data-add-loot>Loot rapido</button>
          <button class="primary" data-add-item>Nuovo oggetto</button>
        </div>
      </header>
      <div class="filters">
        <input type="search" placeholder="Cerca" data-search />
        <select data-category></select>
        <select data-equipable></select>
      </div>
      <div class="carry-widget">
        <span>Carico totale</span>
        <strong>${formatWeight(totalWeight, weightUnit)}</strong>
      </div>
      <div data-inventory-list></div>
    </section>
  `;

  const listEl = container.querySelector('[data-inventory-list]');
  const searchInput = container.querySelector('[data-search]');
  const categorySelect = container.querySelector('[data-category]');
  const equipableSelect = container.querySelector('[data-equipable]');
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
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.equipable ? `${cat.label} · equipaggiabile` : cat.label;
    categorySelect.appendChild(option);
  });
  [
    { value: '', label: 'Tutti' },
    { value: 'equipable', label: 'Equipaggiabili' },
    { value: 'non-equipable', label: 'Non equipaggiabili' }
  ].forEach((optionData) => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    equipableSelect.appendChild(option);
  });

  function renderList() {
    const term = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    const equipableFilter = equipableSelect.value;
    const filtered = items.filter((item) => {
      const matchesTerm = item.name.toLowerCase().includes(term);
      const matchesCategory = !category || item.category === category;
      const matchesEquipable = !equipableFilter
        || (equipableFilter === 'equipable' && item.equipable)
        || (equipableFilter === 'non-equipable' && !item.equipable);
      return matchesTerm && matchesCategory && matchesEquipable;
    });

    listEl.innerHTML = buildInventoryTree(filtered);
    listEl.querySelectorAll('[data-edit]')
      .forEach((btn) => btn.addEventListener('click', () => {
        const item = items.find((entry) => entry.id === btn.dataset.edit);
        if (item) openItemModal(activeCharacter, item, items, renderInventory.bind(null, container));
      }));
    listEl.querySelectorAll('[data-delete]')
      .forEach((btn) => btn.addEventListener('click', async () => {
        const item = items.find((entry) => entry.id === btn.dataset.delete);
        if (!item) return;
        const shouldDelete = await openConfirmModal({ message: 'Eliminare oggetto?' });
        if (!shouldDelete) return;
        try {
          await deleteItem(item.id);
          createToast('Oggetto eliminato');
          renderInventory(container);
        } catch (error) {
          createToast('Errore eliminazione', 'error');
        }
      }));
  listEl.querySelectorAll('[data-use]')
      .forEach((btn) => btn.addEventListener('click', async () => {
        const item = items.find((entry) => entry.id === btn.dataset.use);
        if (!item) return;
        if (item.qty <= 0) {
          createToast('Quantità esaurita', 'error');
          return;
        }
        try {
          const nextQty = Math.max(item.qty - 1, 0);
          await updateItem(item.id, { qty: nextQty });
          createToast('Consumabile usato');
          renderInventory(container);
        } catch (error) {
          createToast('Errore utilizzo consumabile', 'error');
        }
      }));
  }

  renderList();
  searchInput.addEventListener('input', renderList);
  categorySelect.addEventListener('change', renderList);
  equipableSelect.addEventListener('change', renderList);

  container.querySelectorAll('[data-unequip]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = items.find((entry) => entry.id === btn.dataset.unequip);
      if (!item) return;
      try {
        await updateItem(item.id, { equip_slot: null, equip_slots: [] });
        createToast('Equip rimosso');
        renderInventory(container);
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
        renderInventory(container);
      } catch (error) {
        createToast('Errore attunement', 'error');
      }
    }));

  container.querySelectorAll('[data-money-action]')
    .forEach((button) => button.addEventListener('click', async () => {
      const direction = button.dataset.moneyAction;
      const title = direction === 'pay' ? 'Paga monete' : 'Ricevi monete';
      const submitLabel = direction === 'pay' ? 'Paga' : 'Ricevi';
      const formData = await openFormModal({ title, submitLabel, content: moneyFields() });
      if (!formData) return;
      if (!wallet) {
        wallet = {
          user_id: activeCharacter.user_id,
          character_id: activeCharacter.id,
          cp: 0,
          sp: 0,
          gp: 0,
          pp: 0
        };
      }
      const coin = formData.get('coin');
      const amount = Number(formData.get('amount') || 0);
      const delta = {
        cp: coin === 'cp' ? amount : 0,
        sp: coin === 'sp' ? amount : 0,
        gp: coin === 'gp' ? amount : 0,
        pp: coin === 'pp' ? amount : 0
      };
      const sign = direction === 'pay' ? -1 : 1;
      const signedDelta = Object.fromEntries(
        Object.entries(delta).map(([key, value]) => [key, value * sign])
      );
      const nextWallet = applyMoneyDelta(wallet, signedDelta);

      try {
        const saved = await upsertWallet({ ...nextWallet, user_id: wallet.user_id, character_id: wallet.character_id });
        await createTransaction({
          user_id: wallet.user_id,
          character_id: wallet.character_id,
          direction,
          amount: signedDelta,
          reason: formData.get('reason'),
          occurred_on: formData.get('occurred_on')
        });
        updateCache('wallet', saved);
        await cacheSnapshot({ wallet: saved });
        createToast('Wallet aggiornato');
        renderInventory(container);
      } catch (error) {
        createToast('Errore aggiornamento denaro', 'error');
      }
    }));

  const transactionsButton = container.querySelector('[data-view-transactions]');
  if (transactionsButton) {
    transactionsButton.addEventListener('click', async () => {
      if (state.offline) {
        createToast('Transazioni disponibili solo online', 'error');
        return;
      }
      try {
        const transactions = await fetchTransactions(activeCharacter.id);
        await openFormModal({
          title: 'Transazioni',
          submitLabel: 'Chiudi',
          cancelLabel: 'Chiudi',
          content: buildTransactionList(transactions),
          cardClass: 'modal-card--scrollable'
        });
      } catch (error) {
        createToast('Errore caricamento transazioni', 'error');
      }
    });
  }

  const lootButton = container.querySelector('[data-add-loot]');
  if (lootButton) {
    lootButton.addEventListener('click', async () => {
      const formData = await openFormModal({
        title: 'Aggiungi loot',
        submitLabel: 'Aggiungi',
        content: buildLootFields(weightStep)
      });
      if (!formData) return;
      try {
        await createItem({
          user_id: activeCharacter.user_id,
          character_id: activeCharacter.id,
          name: formData.get('name'),
          qty: Number(formData.get('qty')),
          weight: Number(formData.get('weight')),
          value_cp: Number(formData.get('value_cp')),
          category: 'loot',
          equipable: false,
          equip_slot: null,
          equip_slots: [],
          sovrapponibile: false
        });
        createToast('Loot aggiunto');
        renderInventory(container);
      } catch (error) {
        createToast('Errore loot', 'error');
      }
    });
  }

  container.querySelector('[data-add-item]').addEventListener('click', () => {
    openItemModal(activeCharacter, null, items, renderInventory.bind(null, container));
  });
}

function buildTransactionList(transactions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'transaction-list';
  if (!transactions.length) {
    wrapper.innerHTML = '<p class="muted">Nessuna transazione registrata.</p>';
    return wrapper;
  }
  const list = document.createElement('ul');
  list.className = 'transaction-items';
  transactions.forEach((transaction) => {
    const item = document.createElement('li');
    const directionLabel = transaction.direction === 'pay' ? 'Pagamento' : 'Entrata';
    const amountLabel = formatTransactionAmount(transaction.amount);
    const dateLabel = formatTransactionDate(transaction.occurred_on || transaction.created_at);
    item.innerHTML = `
      <div>
        <strong>${directionLabel}</strong>
        <p class="muted">${transaction.reason || 'Nessuna nota'} · ${dateLabel}</p>
      </div>
      <span>${amountLabel}</span>
    `;
    list.appendChild(item);
  });
  wrapper.appendChild(list);
  return wrapper;
}

function formatTransactionAmount(amount) {
  const normalized = normalizeTransactionAmount(amount);
  const entries = ['pp', 'gp', 'sp', 'cp']
    .map((coin) => ({ coin, value: Number(normalized?.[coin] ?? 0) }))
    .filter((entry) => entry.value !== 0);
  if (!entries.length) return '0 gp';
  return entries.map((entry) => formatCoin(entry.value, entry.coin)).join(' · ');
}

function normalizeTransactionAmount(amount) {
  if (!amount) return {};
  if (typeof amount === 'string') {
    try {
      return JSON.parse(amount);
    } catch (error) {
      return {};
    }
  }
  return amount;
}

function formatTransactionDate(value) {
  if (!value) return 'Data non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data non disponibile';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function buildInventoryTree(items) {
  const containers = items.filter((item) => item.category === 'container');
  const topLevel = items.filter((item) => !item.container_item_id && item.category !== 'container');

  const containerSections = containers.map((container) => {
    const children = items.filter((item) => item.container_item_id === container.id);
    return `
      <div class="inventory-group">
        <h4>${container.name}</h4>
        ${buildItemList(children)}
      </div>
    `;
  }).join('');

  return `
    ${containerSections}
    <div class="inventory-group">
      <h4>Oggetti</h4>
      ${buildItemList(topLevel)}
    </div>
  `;
}

function buildItemList(items) {
  if (!items.length) {
    return '<p class="muted">Nessun oggetto.</p>';
  }
  return `
    <ul class="inventory-list">
      ${items.map((item) => `
        <li>
          <div class="item-info">
            ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
            <div>
              <strong>${item.name}</strong>
            <p class="muted">
              ${getCategoryLabel(item.category)} · ${item.qty}x · ${item.weight ?? 0} lb
            </p>
            <div class="tag-row">
              ${item.equipable ? `<span class="chip">equipaggiabile${getEquipSlots(item).length ? ` · ${getBodyPartLabels(getEquipSlots(item))}` : ''}</span>` : ''}
              ${item.sovrapponibile ? '<span class="chip">sovrapponibile</span>' : ''}
              ${item.attunement_active ? '<span class="chip">attuned</span>' : ''}
            </div>
            </div>
          </div>
          <div class="actions">
            ${item.category === 'consumable' ? `<button data-use="${item.id}">Usa</button>` : ''}
            <button data-edit="${item.id}">Modifica</button>
            <button data-delete="${item.id}">Elimina</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
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

function moneyFields() {
  return `
    <div class="money-grid compact-grid-fields">
      <label class="field">
        <span>Quantità</span>
        <input name="amount" type="number" value="0" min="0" />
      </label>
      <label class="field">
        <span>Tipo moneta</span>
        <select name="coin">
          <option value="pp">Platino (PP)</option>
          <option value="gp">Oro (GP)</option>
          <option value="sp">Argento (SP)</option>
          <option value="cp">Rame (CP)</option>
        </select>
      </label>
    </div>
    <label class="field">
      <span>Motivo</span>
      <input name="reason" placeholder="Motivo" />
    </label>
    <label class="field">
      <span>Data</span>
      <input name="occurred_on" type="date" value="${new Date().toISOString().split('T')[0]}" />
    </label>
  `;
}

function buildLootFields(weightStep) {
  return `
    <div class="compact-field-grid">
      <label class="field">
        <span>Nome</span>
        <input name="name" required />
      </label>
      <label class="field">
        <span>Quantità</span>
        <input name="qty" type="number" value="1" />
      </label>
      <label class="field">
        <span>Peso</span>
        <input name="weight" type="number" value="0" min="0" step="${weightStep}" />
      </label>
      <label class="field">
        <span>Valore (cp)</span>
        <input name="value_cp" type="number" value="0" />
      </label>
    </div>
  `;
}

function getCategoryLabel(category) {
  return categoryLabels.get(category) ?? (category ? category : 'Altro');
}

function getBodyPartLabel(part) {
  return bodyPartLabels.get(part) ?? part;
}

function getBodyPartLabels(parts) {
  return parts.map((part) => getBodyPartLabel(part)).join(', ');
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

async function openItemModal(character, item, items, onSave) {
  const fields = document.createElement('div');
  fields.className = 'drawer-form';
  fields.appendChild(buildInput({ label: 'Nome', name: 'name', value: item?.name ?? '' }));
  fields.appendChild(buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../oggetto.png',
    value: item?.image_url ?? ''
  }));
  fields.appendChild(buildInput({ label: 'Quantità', name: 'qty', type: 'number', value: item?.qty ?? 1 }));
  const weightField = buildInput({ label: 'Peso', name: 'weight', type: 'number', value: item?.weight ?? 0 });
  const weightInput = weightField.querySelector('input');
  if (weightInput) {
    const unit = getWeightUnit(character);
    weightInput.min = '0';
    weightInput.step = unit === 'kg' ? '0.1' : '1';
  }
  fields.appendChild(weightField);
  fields.appendChild(buildInput({ label: 'Valore (cp)', name: 'value_cp', type: 'number', value: item?.value_cp ?? 0 }));
  const categorySelect = buildSelect(
    [{ value: '', label: 'Seleziona' }, ...itemCategories],
    item?.category ?? ''
  );
  categorySelect.name = 'category';
  const categoryField = document.createElement('label');
  categoryField.className = 'field';
  categoryField.innerHTML = '<span>Categoria</span>';
  categoryField.appendChild(categorySelect);
  fields.appendChild(categoryField);

  const containerOptions = [{ value: '', label: 'Nessuno' }].concat(
    items.filter((entry) => entry.category === 'container').map((entry) => ({
      value: entry.id,
      label: entry.name
    }))
  );
  const containerSelect = buildSelect(containerOptions, item?.container_item_id ?? '');
  containerSelect.name = 'container_item_id';
  const containerField = document.createElement('label');
  containerField.className = 'field';
  containerField.innerHTML = '<span>Contenitore</span>';
  containerField.appendChild(containerSelect);
  fields.appendChild(containerField);

  const equipableWrapper = document.createElement('div');
  equipableWrapper.className = 'compact-field-grid';
  const equipableField = document.createElement('label');
  equipableField.className = 'checkbox';
  equipableField.innerHTML = '<input type="checkbox" name="equipable" /> <span>Equipaggiabile</span>';
  const equipableInput = equipableField.querySelector('input');
  const overlayableField = document.createElement('label');
  overlayableField.className = 'checkbox';
  overlayableField.innerHTML = '<input type="checkbox" name="sovrapponibile" /> <span>Sovrapponibile</span>';
  const overlayableInput = overlayableField.querySelector('input');
  const equipSlotsField = document.createElement('fieldset');
  equipSlotsField.className = 'equip-slot-field';
  equipSlotsField.innerHTML = '<legend>Punti del corpo</legend>';
  const equipSlotList = document.createElement('div');
  equipSlotList.className = 'equip-slot-list';
  const selectedSlots = getEquipSlots(item);
  const equipSlotInputs = bodyParts.map((part) => {
    const label = document.createElement('label');
    label.className = 'checkbox';
    label.innerHTML = `<input type="checkbox" name="equip_slots" value="${part.value}" /> <span>${part.label}</span>`;
    const input = label.querySelector('input');
    if (input && selectedSlots.includes(part.value)) {
      input.checked = true;
    }
    equipSlotList.appendChild(label);
    return input;
  });
  equipSlotsField.appendChild(equipSlotList);
  equipableWrapper.appendChild(equipableField);
  equipableWrapper.appendChild(overlayableField);
  fields.appendChild(equipableWrapper);
  fields.appendChild(equipSlotsField);

  const attunement = document.createElement('label');
  attunement.className = 'checkbox';
  attunement.innerHTML = '<input type="checkbox" name="attunement_active" /> <span>Sintonia attiva</span>';
  const attunementInput = attunement.querySelector('input');
  fields.appendChild(attunement);

  fields.appendChild(buildTextarea({ label: 'Note', name: 'notes', value: item?.notes ?? '' }));

  const proficiencySection = document.createElement('div');
  proficiencySection.className = 'drawer-form';
  const weaponTypeField = document.createElement('label');
  weaponTypeField.className = 'field';
  weaponTypeField.innerHTML = '<span>Tipo arma</span>';
  const weaponTypeSelect = buildSelect(weaponTypes, item?.weapon_type ?? '');
  weaponTypeSelect.name = 'weapon_type';
  weaponTypeField.appendChild(weaponTypeSelect);

  const armorTypeField = document.createElement('label');
  armorTypeField.className = 'field';
  armorTypeField.innerHTML = '<span>Tipo armatura</span>';
  const armorTypeSelect = buildSelect(armorTypes, item?.armor_type ?? '');
  armorTypeSelect.name = 'armor_type';
  armorTypeField.appendChild(armorTypeSelect);

  const shieldField = document.createElement('label');
  shieldField.className = 'checkbox';
  shieldField.innerHTML = '<input type="checkbox" name="is_shield" /> <span>Scudo</span>';
  const shieldInput = shieldField.querySelector('input');

  const armorClassField = buildInput({
    label: 'Classe armatura base',
    name: 'armor_class',
    type: 'number',
    value: item?.armor_class ?? ''
  });
  const armorClassInput = armorClassField.querySelector('input');
  const armorBonusField = buildInput({
    label: 'Bonus armatura',
    name: 'armor_bonus',
    type: 'number',
    value: item?.armor_bonus ?? 0
  });
  const armorBonusInput = armorBonusField.querySelector('input');
  const shieldBonusField = buildInput({
    label: 'Bonus scudo',
    name: 'shield_bonus',
    type: 'number',
    value: item?.shield_bonus ?? 2
  });
  const shieldBonusInput = shieldBonusField.querySelector('input');

  proficiencySection.appendChild(weaponTypeField);
  proficiencySection.appendChild(armorTypeField);
  proficiencySection.appendChild(shieldField);
  proficiencySection.appendChild(armorClassField);
  proficiencySection.appendChild(armorBonusField);
  proficiencySection.appendChild(shieldBonusField);
  fields.appendChild(proficiencySection);

  if (attunementInput) {
    attunementInput.checked = item?.attunement_active ?? false;
  }
  if (equipableInput) {
    equipableInput.checked = item?.equipable ?? false;
  }
  if (overlayableInput) {
    overlayableInput.checked = item?.sovrapponibile ?? false;
  }
  if (shieldInput) {
    shieldInput.checked = item?.is_shield ?? false;
  }
  const updateEquipmentFields = () => {
    const equipableEnabled = equipableInput?.checked ?? false;
    equipSlotInputs.forEach((input) => {
      if (!input) return;
      input.disabled = !equipableEnabled;
      if (!equipableEnabled) {
        input.checked = false;
      }
    });
    if (overlayableInput) {
      overlayableInput.disabled = !equipableEnabled;
      if (!equipableEnabled) {
        overlayableInput.checked = false;
      }
    }
    const isWeapon = categorySelect.value === 'weapon';
    const isArmor = categorySelect.value === 'armor';
    weaponTypeSelect.disabled = !isWeapon;
    armorTypeSelect.disabled = !isArmor;
    if (shieldInput) {
      shieldInput.disabled = !isArmor;
    }
    if (armorClassInput) {
      armorClassInput.disabled = !isArmor;
    }
    if (armorBonusInput) {
      armorBonusInput.disabled = !isArmor;
    }
    if (shieldBonusInput) {
      shieldBonusInput.disabled = !isArmor || !(shieldInput?.checked ?? false);
    }
  };
  equipableInput?.addEventListener('change', updateEquipmentFields);
  categorySelect.addEventListener('change', updateEquipmentFields);
  shieldInput?.addEventListener('change', updateEquipmentFields);
  updateEquipmentFields();

  const formData = await openFormModal({
    title: item ? 'Modifica oggetto' : 'Nuovo oggetto',
    submitLabel: item ? 'Salva' : 'Crea',
    content: fields,
    cardClass: ['modal-card--wide', 'modal-card--scrollable']
  });
  if (!formData) return;
  const equipableEnabled = formData.get('equipable') === 'on';
  const equipSlots = equipableEnabled ? formData.getAll('equip_slots') : [];
  const equipSlot = equipSlots[0] || null;
  const category = formData.get('category');
  if (equipSlots.length && !hasProficiencyForItem(character, formData)) {
    createToast('Non hai la competenza per equipaggiare questo oggetto', 'error');
    return;
  }
  const isOverlayable = formData.get('sovrapponibile') === 'on';
  if (equipSlots.length && !isOverlayable) {
    const conflicting = items.filter((entry) => entry.id !== item?.id)
      .filter((entry) => getEquipSlots(entry).some((slot) => equipSlots.includes(slot)));
    if (conflicting.length) {
      createToast('Uno o più slot selezionati sono già occupati', 'error');
      return;
    }
  }
  const payload = {
    user_id: character.user_id,
    character_id: character.id,
    name: formData.get('name'),
    image_url: formData.get('image_url')?.trim() || null,
    qty: Number(formData.get('qty')),
    weight: Number(formData.get('weight')),
    value_cp: Number(formData.get('value_cp')),
    category,
    container_item_id: formData.get('container_item_id') || null,
    equipable: equipableEnabled,
    equip_slot: equipSlot,
    equip_slots: equipSlots,
    sovrapponibile: isOverlayable,
    attunement_active: formData.get('attunement_active') === 'on',
    notes: formData.get('notes'),
    weapon_type: formData.get('weapon_type') || null,
    armor_type: formData.get('armor_type') || null,
    is_shield: formData.get('is_shield') === 'on',
    armor_class: Number(formData.get('armor_class')) || null,
    armor_bonus: Number(formData.get('armor_bonus')) || 0,
    shield_bonus: Number(formData.get('shield_bonus')) || 0
  };

  try {
    if (item) {
      await updateItem(item.id, payload);
      createToast('Oggetto aggiornato');
    } else {
      await createItem(payload);
      createToast('Oggetto creato');
    }
    onSave();
  } catch (error) {
    createToast('Errore salvataggio oggetto', 'error');
  }
}

function getWeightUnit(character) {
  return character.data?.settings?.weight_unit ?? 'lb';
}

function hasProficiencyForItem(character, formData) {
  const proficiencies = character.data?.proficiencies || {};
  const category = formData.get('category');
  if (category === 'weapon') {
    const weaponType = formData.get('weapon_type');
    if (!weaponType) return false;
    return weaponType === 'simple'
      ? Boolean(proficiencies.weapon_simple)
      : Boolean(proficiencies.weapon_martial);
  }
  if (category === 'armor') {
    const isShield = formData.get('is_shield') === 'on';
    if (isShield) {
      return Boolean(proficiencies.shield);
    }
    const armorType = formData.get('armor_type');
    if (!armorType) return false;
    if (armorType === 'light') return Boolean(proficiencies.armor_light);
    if (armorType === 'medium') return Boolean(proficiencies.armor_medium);
    return Boolean(proficiencies.armor_heavy);
  }
  return true;
}
