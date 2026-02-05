import { fetchItems, createItem, updateItem, deleteItem } from './inventoryApi.js';
import { getState, normalizeCharacterId, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { applyMoneyDelta, calcTotalWeight } from '../../lib/calc.js';
import { formatWeight } from '../../lib/format.js';
import { createToast, openConfirmModal, openFormModal } from '../../ui/components.js';
import {
  fetchWallet,
  upsertWallet,
  createTransaction,
  fetchTransactions,
  updateTransaction,
  deleteTransaction
} from '../wallet/walletApi.js';
import { renderWalletSummary } from '../wallet/wallet.js';
import { categories, itemCategories } from './constants.js';
import { openItemImageModal, openItemModal } from './modals.js';
import { buildInventoryTree, buildLootFields, buildTransactionList, exchangeFields, moneyFields } from './render.js';
import { getWeightUnit, normalizeTransactionAmount } from './utils.js';

export async function renderInventory(container) {
  const state = getState();
  const normalizedActiveId = normalizeCharacterId(state.activeCharacterId);
  const activeCharacter = state.characters.find((char) => normalizeCharacterId(char.id) === normalizedActiveId);
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
  container.innerHTML = `
    <div class="inventory-layout">
      <section class="card inventory-main">
        <header class="card-header">
          <p class="eyebrow">Inventario</p>
          <div class="button-row">
            <button class="icon-button icon-button--add" type="button" data-add-item aria-label="Nuovo oggetto">
              <span aria-hidden="true">+</span>
            </button>
          </div>
        </header>
        <div class="filters">
          <input type="search" placeholder="Cerca" data-search />
          <select data-category></select>
          <label class="toggle-pill filter-toggle">
            <input type="checkbox" data-equipable-filter />
            <span>Oggetti equipaggiabili</span>
          </label>
          <label class="toggle-pill filter-toggle">
            <input type="checkbox" data-magic-filter />
            <span>Oggetti magici</span>
          </label>
        </div>
        <div class="carry-widget">
          <span>Carico totale</span>
          <strong data-carry-total>${formatWeight(totalWeight, weightUnit)}</strong>
        </div>
        <div data-inventory-list></div>
      </section>
      <div class="inventory-side">
        <section class="card inventory-wallet">
          <header class="card-header">
            <p class="eyebrow">Monete</p>
            <div class="button-row">
              <button class="icon-button icon-button--swap" type="button" data-exchange-coins aria-label="Scambia monete" title="Scambia monete">
                <span aria-hidden="true">⇄</span>
              </button>
            </div>
          </header>
          ${renderWalletSummary(wallet)}
        </section>
        <section class="card">
          <header class="card-header">
            <p class="eyebrow">Transazioni</p>
          </header>
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
  const equipableFilter = container.querySelector('[data-equipable-filter]');
  const magicFilter = container.querySelector('[data-magic-filter]');
  const carryTotalEl = container.querySelector('[data-carry-total]');
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.equipable ? `${cat.label}` : cat.label;
    categorySelect.appendChild(option);
  });

  function renderList() {
    const term = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    const equipableOnly = equipableFilter?.checked ?? false;
    const magicOnly = magicFilter?.checked ?? false;
    const filtered = items.filter((item) => {
      const matchesTerm = item.name.toLowerCase().includes(term);
      const matchesCategory = !category || item.category === category;
      const matchesEquipable = !equipableOnly || item.equipable;
      const matchesMagic = !magicOnly || item.is_magic;
      return matchesTerm && matchesCategory && matchesEquipable && matchesMagic;
    });

    listEl.innerHTML = buildInventoryTree(filtered, weightUnit);
    if (carryTotalEl) {
      carryTotalEl.textContent = formatWeight(calcTotalWeight(filtered), weightUnit);
    }
    listEl.querySelectorAll('[data-edit]')
      .forEach((btn) => btn.addEventListener('click', () => {
        const item = items.find((entry) => entry.id === btn.dataset.edit);
        if (item) openItemModal(activeCharacter, item, items, renderInventory.bind(null, container));
      }));
    listEl.querySelectorAll('[data-item-image]')
      .forEach((image) => image.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const item = items.find((entry) => String(entry.id) === image.dataset.itemImage);
        if (item) openItemImageModal(item);
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
  equipableFilter?.addEventListener('change', renderList);
  magicFilter?.addEventListener('change', renderList);

  document.querySelectorAll('[data-money-action]')
    .forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = 'true';
      button.addEventListener('click', async () => {
        const direction = button.dataset.moneyAction;
        const title = direction === 'pay' ? 'Paga monete' : 'Ricevi monete';
        const submitLabel = direction === 'pay' ? 'Paga' : 'Ricevi';
        const formData = await openFormModal({ title, submitLabel, content: moneyFields({ direction }) });
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
      });
    });

  const exchangeButton = container.querySelector('[data-exchange-coins]');
  if (exchangeButton && !exchangeButton.dataset.bound) {
    exchangeButton.dataset.bound = 'true';
    exchangeButton.addEventListener('click', async () => {
      const coinValues = { cp: 1, sp: 10, gp: 100, pp: 1000 };
      const coinLabels = { cp: 'Rame (CP)', sp: 'Argento (SP)', gp: 'Oro (GP)', pp: 'Platino (PP)' };
      const available = {
        cp: Number(wallet?.cp ?? 0),
        sp: Number(wallet?.sp ?? 0),
        gp: Number(wallet?.gp ?? 0),
        pp: Number(wallet?.pp ?? 0)
      };
      const availableCoins = Object.keys(available).filter((coin) => available[coin] > 0);
      const defaultSource = availableCoins[0] ?? 'gp';
      const defaultTarget = availableCoins.find((coin) => coin !== defaultSource)
        ?? (defaultSource === 'pp' ? 'gp' : 'pp');
      const formData = await openFormModal({
        title: 'Scambia monete',
        submitLabel: 'Scambia',
        content: exchangeFields({
          available,
          source: defaultSource,
          target: defaultTarget
        }),
        onOpen: ({ fieldsEl }) => {
          if (!fieldsEl) return null;
          const sourceSelect = fieldsEl.querySelector('select[name="source"]');
          const targetSelect = fieldsEl.querySelector('select[name="target"]');
          const amountInput = fieldsEl.querySelector('input[name="amount"]');
          const targetInput = fieldsEl.querySelector('input[name="target_amount"]');
          const maxButton = fieldsEl.querySelector('[data-exchange-max]');
          const availableHint = fieldsEl.querySelector('[data-exchange-available]');

          const clampExchange = (source, target, amount) => {
            const sourceValue = coinValues[source];
            const targetValue = coinValues[target];
            if (!sourceValue || !targetValue) {
              return { amount: 0, targetAmount: 0 };
            }
            const availableAmount = Number(available[source] ?? 0);
            const normalizedAmount = Math.min(Number(amount) || 0, availableAmount);
            const totalCp = normalizedAmount * sourceValue;
            const targetAmount = Math.floor(totalCp / targetValue);
            const adjustedAmount = Math.floor((targetAmount * targetValue) / sourceValue);
            return { amount: adjustedAmount, targetAmount };
          };

          const updateAvailableHint = (source) => {
            if (!availableHint) return;
            if (!source) {
              availableHint.textContent = 'Nessuna moneta disponibile';
              return;
            }
            const label = coinLabels[source] ?? source;
            availableHint.textContent = `Disponibili: ${available[source] ?? 0} ${label}`;
          };

          const syncValues = (nextAmount, { useAdjustedAmount = true } = {}) => {
            const source = sourceSelect?.value;
            const target = targetSelect?.value;
            if (!source || !target || !amountInput || !targetInput) return;
            const result = clampExchange(source, target, nextAmount);
            if (useAdjustedAmount) {
              amountInput.value = result.amount;
            }
            targetInput.value = result.targetAmount;
          };

          if (sourceSelect) {
            updateAvailableHint(sourceSelect.value);
          }
          if (amountInput && targetInput) {
            syncValues(amountInput.value, { useAdjustedAmount: true });
          }

          const onSourceChange = () => {
            updateAvailableHint(sourceSelect?.value);
            syncValues(amountInput?.value ?? 0, { useAdjustedAmount: true });
          };
          const onTargetChange = () => {
            syncValues(amountInput?.value ?? 0, { useAdjustedAmount: true });
          };
          const onAmountInput = () => {
            syncValues(amountInput?.value ?? 0, { useAdjustedAmount: true });
          };
          const onMaxClick = () => {
            if (!sourceSelect || !targetSelect || !amountInput) return;
            const source = sourceSelect.value;
            const target = targetSelect.value;
            const maxAmount = clampExchange(source, target, available[source] ?? 0).amount;
            amountInput.value = maxAmount;
            syncValues(maxAmount, { useAdjustedAmount: false });
          };

          sourceSelect?.addEventListener('change', onSourceChange);
          targetSelect?.addEventListener('change', onTargetChange);
          amountInput?.addEventListener('input', onAmountInput);
          maxButton?.addEventListener('click', onMaxClick);

          return () => {
            sourceSelect?.removeEventListener('change', onSourceChange);
            targetSelect?.removeEventListener('change', onTargetChange);
            amountInput?.removeEventListener('input', onAmountInput);
            maxButton?.removeEventListener('click', onMaxClick);
          };
        }
      });
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
      const amount = Number(formData.get('amount') || 0);
      const source = formData.get('source');
      const target = formData.get('target');
      const availableAmount = Number(wallet[source] || 0);
      const sourceValue = coinValues[source];
      const targetValue = coinValues[target];
      const normalizedAmount = Math.min(amount, availableAmount);
      const totalCp = normalizedAmount * sourceValue;
      const targetAmount = Math.floor(totalCp / targetValue);
      const adjustedAmount = Math.floor((targetAmount * targetValue) / sourceValue);
      if (amount <= 0) {
        createToast('Inserisci un importo valido', 'error');
        return;
      }
      if (source === target) {
        createToast('Scegli due monete diverse', 'error');
        return;
      }
      if (adjustedAmount <= 0) {
        createToast('Importo troppo basso per il cambio', 'error');
        return;
      }
      if (adjustedAmount > Number(wallet[source] || 0)) {
        createToast('Monete insufficienti', 'error');
        return;
      }
      if (adjustedAmount !== amount) {
        createToast(`Adeguato a ${adjustedAmount} ${source.toUpperCase()} per un cambio preciso`, 'info');
      }
      const delta = { cp: 0, sp: 0, gp: 0, pp: 0, [source]: -adjustedAmount, [target]: targetAmount };
      const nextWallet = applyMoneyDelta(wallet, delta);

      try {
        const saved = await upsertWallet({ ...nextWallet, user_id: wallet.user_id, character_id: wallet.character_id });
        updateCache('wallet', saved);
        await cacheSnapshot({ wallet: saved });
        createToast('Scambio completato');
        renderInventory(container);
      } catch (error) {
        createToast('Errore scambio monete', 'error');
      }
    });
  }

  const transactionAmount = (transaction) => {
    const normalized = normalizeTransactionAmount(transaction.amount);
    return {
      cp: Number(normalized.cp ?? 0),
      sp: Number(normalized.sp ?? 0),
      gp: Number(normalized.gp ?? 0),
      pp: Number(normalized.pp ?? 0)
    };
  };

  const formatDateValue = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  const findPrimaryCoin = (amounts) => {
    const entries = ['pp', 'gp', 'sp', 'cp']
      .map((coin) => ({ coin, value: Number(amounts[coin] ?? 0) }))
      .find((entry) => entry.value !== 0);
    return entries ?? { coin: 'gp', value: 0 };
  };

  container.querySelectorAll('[data-edit-transaction]')
    .forEach((button) => button.addEventListener('click', async () => {
      const transaction = transactions.find((entry) => entry.id === button.dataset.editTransaction);
      if (!transaction) return;
      const currentAmounts = transactionAmount(transaction);
      const { coin, value } = findPrimaryCoin(currentAmounts);
      const formData = await openFormModal({
        title: 'Modifica transazione',
        submitLabel: 'Salva',
        content: moneyFields({
          amount: Math.abs(value),
          coin,
          reason: transaction.reason ?? '',
          occurredOn: formatDateValue(transaction.occurred_on || transaction.created_at),
          direction: transaction.direction,
          includeDirection: true
        })
      });
      if (!formData) return;
      const nextDirection = formData.get('direction') || transaction.direction;
      const nextCoin = formData.get('coin');
      const amountValue = Number(formData.get('amount') || 0);
      const sign = nextDirection === 'pay' ? -1 : 1;
      const nextSigned = { cp: 0, sp: 0, gp: 0, pp: 0, [nextCoin]: amountValue * sign };
      const delta = Object.fromEntries(
        Object.keys(nextSigned).map((key) => [key, (nextSigned[key] || 0) - (currentAmounts[key] || 0)])
      );
      const nextWallet = wallet ? applyMoneyDelta(wallet, delta) : null;

      try {
        if (nextWallet) {
          const saved = await upsertWallet({ ...nextWallet, user_id: wallet.user_id, character_id: wallet.character_id });
          updateCache('wallet', saved);
          await cacheSnapshot({ wallet: saved });
        }
        await updateTransaction(transaction.id, {
          direction: nextDirection,
          amount: nextSigned,
          reason: formData.get('reason'),
          occurred_on: formData.get('occurred_on')
        });
        createToast('Transazione aggiornata');
        renderInventory(container);
      } catch (error) {
        createToast('Errore aggiornamento transazione', 'error');
      }
    }));

  container.querySelectorAll('[data-delete-transaction]')
    .forEach((button) => button.addEventListener('click', async () => {
      const transaction = transactions.find((entry) => entry.id === button.dataset.deleteTransaction);
      if (!transaction) return;
      const shouldDelete = await openConfirmModal({ message: 'Eliminare transazione?' });
      if (!shouldDelete) return;
      const currentAmounts = transactionAmount(transaction);
      const delta = Object.fromEntries(
        Object.keys(currentAmounts).map((key) => [key, -currentAmounts[key]])
      );
      const nextWallet = wallet ? applyMoneyDelta(wallet, delta) : null;

      try {
        if (nextWallet) {
          const saved = await upsertWallet({ ...nextWallet, user_id: wallet.user_id, character_id: wallet.character_id });
          updateCache('wallet', saved);
          await cacheSnapshot({ wallet: saved });
        }
        await deleteTransaction(transaction.id);
        createToast('Transazione eliminata');
        renderInventory(container);
      } catch (error) {
        createToast('Errore eliminazione transazione', 'error');
      }
    }));

  const lootButton = document.querySelector('[data-add-loot]');
  if (lootButton && !lootButton.dataset.bound) {
    lootButton.dataset.bound = 'true';
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
          volume: Number(formData.get('volume')) || 0,
          value_cp: Number(formData.get('value_cp')),
          category: 'loot',
          equipable: false,
          equip_slot: null,
          equip_slots: [],
          sovrapponibile: false,
          is_magic: false,
          max_volume: null
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
