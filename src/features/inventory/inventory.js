import { fetchItems, createItem, updateItem, deleteItem } from './inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { applyMoneyDelta, calcTotalWeight } from '../../lib/calc.js';
import { formatWeight } from '../../lib/format.js';
import { createToast, openConfirmModal, openFormModal } from '../../ui/components.js';
import { fetchWallet, upsertWallet, createTransaction, fetchTransactions } from '../wallet/walletApi.js';
import { renderWalletSummary } from '../wallet/wallet.js';
import { categories, itemCategories } from './constants.js';
import { openItemModal } from './modals.js';
import { buildEquippedList, buildInventoryTree, buildLootFields, buildTransactionList, moneyFields } from './render.js';
import { getEquipSlots, getWeightUnit } from './utils.js';

export async function renderInventory(container) {
  const state = getState();
  const activeCharacter = state.characters.find((char) => char.id === state.activeCharacterId);
  if (!activeCharacter) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  let items = state.cache.items;
  let wallet = state.cache.wallet;
  let transactions = [];
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
    try {
      transactions = await fetchTransactions(activeCharacter.id);
    } catch (error) {
      createToast('Errore caricamento transazioni', 'error');
    }
  }

  const totalWeight = calcTotalWeight(items);
  const weightUnit = getWeightUnit(activeCharacter);
  const weightStep = weightUnit === 'kg' ? '0.1' : '1';
  const equippedItems = items.filter((item) => getEquipSlots(item).length);
  const attunedCount = items.filter((item) => item.attunement_active).length;
  container.innerHTML = `
    <div class="inventory-layout">
      <section class="card inventory-wallet-wide">
        <header class="card-header">
          <h2 class="eyebrow">Monete</h2>
        </header>
        ${renderWalletSummary(wallet)}
      </section>
      <section class="card inventory-main">
        <header class="card-header">
          <h2 class="eyebrow">Inventario</h2>
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
      <div class="inventory-side">
        <section class="card">
          <header class="card-header">
            <h2 class="eyebrow">Equipaggiamento</h2>
            <span class="pill">Slot Sintonia Attivi: ${attunedCount}</span>
          </header>
          ${buildEquippedList(equippedItems)}
          ${!equippedItems.length ? '<p class="muted">Nessun oggetto equipaggiato.</p>' : ''}
        </section>
        <section class="card">
          <header class="card-header">
            <h2 class="eyebrow">Transazioni</h2>
          </header>
          <div class="button-row">
            <button class="primary" type="button" data-money-action="pay">Paga</button>
            <button class="primary" type="button" data-money-action="receive">Ricevi</button>
          </div>
          <div class="inventory-transactions">
            ${state.offline ? '<p class="muted">Transazioni disponibili solo online.</p>' : buildTransactionList(transactions).outerHTML}
          </div>
        </section>
      </div>
    </div>
  `;

  const listEl = container.querySelector('[data-inventory-list]');
  const searchInput = container.querySelector('[data-search]');
  const categorySelect = container.querySelector('[data-category]');
  const equipableSelect = container.querySelector('[data-equipable]');
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
