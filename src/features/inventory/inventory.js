import { fetchItems, createItem, updateItem, deleteItem } from './inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { applyMoneyDelta, calcTotalWeight } from '../../lib/calc.js';
import { formatWeight } from '../../lib/format.js';
import { buildDrawerLayout, buildInput, buildTextarea, createToast, openDrawer, closeDrawer, buildSelect, openConfirmModal, openFormModal } from '../../ui/components.js';
import { fetchWallet, upsertWallet, createTransaction } from '../wallet/walletApi.js';
import { renderWalletSummary } from '../wallet/wallet.js';

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
  const equippedItems = items.filter((item) => item.equip_slot || item.equipable);
  const attunedCount = items.filter((item) => item.attunement_active).length;
  container.innerHTML = `
    <section class="card compact-card">
      <header class="card-header">
        <h2>Equip</h2>
        <span class="pill">Attunement: ${attunedCount}</span>
      </header>
      <div data-equipment-list>
        ${buildEquipmentCompact(equippedItems)}
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
    <section class="card compact-card">
      <div class="compact-grid">
        <div class="compact-panel">
          <header class="compact-header">
            <h3>Azioni denaro</h3>
          </header>
          ${renderWalletSummary(wallet)}
          <p class="muted wallet-note">Monete: Platino (PP), Oro (GP), Argento (SP), Rame (CP).</p>
          <div class="compact-action-grid">
            <button class="primary" type="button" data-money-action="pay">Paga</button>
            <button class="primary" type="button" data-money-action="receive">Ricevi</button>
          </div>
        </div>
      </div>
    </section>
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
        if (item) openItemDrawer(activeCharacter, item, items, renderInventory.bind(null, container));
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
        await updateItem(item.id, { equip_slot: null });
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
        createToast('Attunement aggiornato');
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
          equip_slot: null
        });
        createToast('Loot aggiunto');
        renderInventory(container);
      } catch (error) {
        createToast('Errore loot', 'error');
      }
    });
  }

  container.querySelector('[data-add-item]').addEventListener('click', () => {
    openItemDrawer(activeCharacter, null, items, renderInventory.bind(null, container));
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
              ${item.equipable ? `<span class="chip">equipaggiabile${item.equip_slot ? ` · ${getBodyPartLabel(item.equip_slot)}` : ''}</span>` : ''}
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

function buildEquipmentCompact(items) {
  if (!items.length) {
    return '<p class="muted">Nessun oggetto equipaggiato.</p>';
  }
  const unassigned = items.filter((item) => !item.equip_slot && item.equipable);
  return `
    ${bodyParts.map((part) => {
      const sectionItems = items.filter((item) => item.equip_slot === part.value);
      return `
        <div class="compact-section">
          <h4>${part.label}</h4>
          ${sectionItems.length ? `
            <ul class="compact-list">
              ${sectionItems.map((item) => `
                <li>
                  <div class="compact-info">
                    <span>${item.name}</span>
                    <span class="muted">${item.category || 'misc'}</span>
                  </div>
                  <div class="compact-actions">
                    <button data-unequip="${item.id}">Rimuovi</button>
                    <button data-attune="${item.id}">
                      ${item.attunement_active ? 'Disattiva attune' : 'Attiva attune'}
                    </button>
                  </div>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="muted">Nessun oggetto.</p>'}
        </div>
      `;
    }).join('')}
    ${unassigned.length ? `
      <div class="compact-section">
        <h4>Equipaggiabili senza slot</h4>
        <ul class="compact-list">
          ${unassigned.map((item) => `
            <li>
              <div class="compact-info">
                <span>${item.name}</span>
                <span class="muted">${item.category || 'misc'}</span>
              </div>
              <div class="compact-actions">
                <button data-unequip="${item.id}">Rimuovi</button>
              </div>
            </li>
          `).join('')}
        </ul>
      </div>
    ` : ''}
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
  const match = bodyParts.find((entry) => entry.value === part);
  return match ? match.label : part;
}

function openItemDrawer(character, item, items, onSave) {
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome', name: 'name', value: item?.name ?? '' }));
  form.appendChild(buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../oggetto.png',
    value: item?.image_url ?? ''
  }));
  form.appendChild(buildInput({ label: 'Quantità', name: 'qty', type: 'number', value: item?.qty ?? 1 }));
  const weightField = buildInput({ label: 'Peso', name: 'weight', type: 'number', value: item?.weight ?? 0 });
  const weightInput = weightField.querySelector('input');
  if (weightInput) {
    const unit = getWeightUnit(character);
    weightInput.min = '0';
    weightInput.step = unit === 'kg' ? '0.1' : '1';
  }
  form.appendChild(weightField);
  form.appendChild(buildInput({ label: 'Valore (cp)', name: 'value_cp', type: 'number', value: item?.value_cp ?? 0 }));
  const categorySelect = buildSelect(
    [{ value: '', label: 'Seleziona' }, ...itemCategories],
    item?.category ?? ''
  );
  categorySelect.name = 'category';
  const categoryField = document.createElement('label');
  categoryField.className = 'field';
  categoryField.innerHTML = '<span>Categoria</span>';
  categoryField.appendChild(categorySelect);
  form.appendChild(categoryField);

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
  form.appendChild(containerField);

  const equipableWrapper = document.createElement('div');
  equipableWrapper.className = 'compact-field-grid';
  const equipableField = document.createElement('label');
  equipableField.className = 'checkbox';
  equipableField.innerHTML = '<input type="checkbox" name="equipable" /> <span>Equipaggiabile</span>';
  const equipSlotField = document.createElement('label');
  equipSlotField.className = 'field';
  equipSlotField.innerHTML = '<span>Punto del corpo</span>';
  const equipSlotSelect = buildSelect(
    [{ value: '', label: 'Nessuno' }, ...bodyParts],
    item?.equip_slot ?? ''
  );
  equipSlotSelect.name = 'equip_slot';
  equipSlotField.appendChild(equipSlotSelect);
  equipableWrapper.appendChild(equipableField);
  equipableWrapper.appendChild(equipSlotField);
  form.appendChild(equipableWrapper);

  const attunement = document.createElement('label');
  attunement.className = 'checkbox';
  attunement.innerHTML = '<input type="checkbox" name="attunement_active" /> <span>Attunement attivo</span>';
  form.appendChild(attunement);

  form.appendChild(buildTextarea({ label: 'Note', name: 'notes', value: item?.notes ?? '' }));

  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.type = 'submit';
  submit.textContent = item ? 'Salva' : 'Crea';
  form.appendChild(submit);

  form.attunement_active.checked = item?.attunement_active ?? false;
  form.equipable.checked = item?.equipable ?? false;
  equipSlotSelect.disabled = !form.equipable.checked;
  form.equipable.addEventListener('change', () => {
    equipSlotSelect.disabled = !form.equipable.checked;
    if (!form.equipable.checked) {
      equipSlotSelect.value = '';
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      user_id: character.user_id,
      character_id: character.id,
      name: formData.get('name'),
      image_url: formData.get('image_url')?.trim() || null,
      qty: Number(formData.get('qty')),
      weight: Number(formData.get('weight')),
      value_cp: Number(formData.get('value_cp')),
      category: formData.get('category'),
      container_item_id: formData.get('container_item_id') || null,
      equipable: formData.get('equipable') === 'on',
      equip_slot: formData.get('equip_slot') || null,
      attunement_active: formData.get('attunement_active') === 'on',
      notes: formData.get('notes')
    };

    try {
      if (item) {
        await updateItem(item.id, payload);
        createToast('Oggetto aggiornato');
      } else {
        await createItem(payload);
        createToast('Oggetto creato');
      }
      closeDrawer();
      onSave();
    } catch (error) {
      createToast('Errore salvataggio oggetto', 'error');
    }
  });

  openDrawer(buildDrawerLayout(item ? 'Modifica oggetto' : 'Nuovo oggetto', form));
}

function getWeightUnit(character) {
  return character.data?.settings?.weight_unit ?? 'lb';
}
