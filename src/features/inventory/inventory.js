import { fetchItems, createItem, updateItem, deleteItem } from './inventoryApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { calcTotalWeight } from '../../lib/calc.js';
import { formatWeight } from '../../lib/format.js';
import { buildDrawerLayout, buildInput, buildTextarea, createToast, openDrawer, closeDrawer, buildSelect } from '../../ui/components.js';

const categories = [
  { value: '', label: 'Tutte' },
  { value: 'gear', label: 'Equipaggiamento' },
  { value: 'loot', label: 'Loot' },
  { value: 'consumable', label: 'Consumabili' },
  { value: 'tool', label: 'Strumenti' },
  { value: 'container', label: 'Contenitore' }
];

export async function renderInventory(container) {
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
      createToast('Errore caricamento inventario', 'error');
    }
  }

  const totalWeight = calcTotalWeight(items);

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Inventario</h2>
        <button class="primary" data-add-item>Nuovo oggetto</button>
      </header>
      <div class="filters">
        <input type="search" placeholder="Cerca" data-search />
        <select data-category></select>
      </div>
      <div class="carry-widget">
        <span>Carico totale</span>
        <strong>${formatWeight(totalWeight, getWeightUnit(activeCharacter))}</strong>
      </div>
      <div data-inventory-list></div>
    </section>
  `;

  const listEl = container.querySelector('[data-inventory-list]');
  const searchInput = container.querySelector('[data-search]');
  const categorySelect = container.querySelector('[data-category]');
  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.value;
    option.textContent = cat.label;
    categorySelect.appendChild(option);
  });

  function renderList() {
    const term = searchInput.value.toLowerCase();
    const category = categorySelect.value;
    const filtered = items.filter((item) => {
      const matchesTerm = item.name.toLowerCase().includes(term);
      const matchesCategory = !category || item.category === category;
      return matchesTerm && matchesCategory;
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
        if (!confirm('Eliminare oggetto?')) return;
        try {
          await deleteItem(item.id);
          createToast('Oggetto eliminato');
          renderInventory(container);
        } catch (error) {
          createToast('Errore eliminazione', 'error');
        }
      }));
  }

  renderList();
  searchInput.addEventListener('input', renderList);
  categorySelect.addEventListener('change', renderList);

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
          <div>
            <strong>${item.name}</strong>
            <p class="muted">
              ${item.category || 'misc'} · ${item.qty}x · ${item.weight ?? 0} lb
            </p>
            <div class="tag-row">
              ${item.equipped_state && item.equipped_state !== 'none' ? `<span class="chip">${item.equipped_state}</span>` : ''}
              ${item.attunement_active ? '<span class="chip">attuned</span>' : ''}
            </div>
          </div>
          <div class="actions">
            <button data-edit="${item.id}">Modifica</button>
            <button data-delete="${item.id}">Elimina</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function openItemDrawer(character, item, items, onSave) {
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome', name: 'name', value: item?.name ?? '' }));
  form.appendChild(buildInput({ label: 'Quantità', name: 'qty', type: 'number', value: item?.qty ?? 1 }));
  form.appendChild(buildInput({ label: 'Peso', name: 'weight', type: 'number', value: item?.weight ?? 0 }));
  form.appendChild(buildInput({ label: 'Valore (cp)', name: 'value_cp', type: 'number', value: item?.value_cp ?? 0 }));
  form.appendChild(buildInput({ label: 'Categoria', name: 'category', value: item?.category ?? '' }));

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

  const equippedField = document.createElement('label');
  equippedField.className = 'field';
  equippedField.innerHTML = '<span>Stato equip</span>';
  const equippedSelect = buildSelect([
    { value: 'none', label: 'Nessuno' },
    { value: 'worn', label: 'Indossato' },
    { value: 'held', label: 'Impugnato' },
    { value: 'equipped', label: 'Equipaggiato' }
  ], item?.equipped_state ?? 'none');
  equippedSelect.name = 'equipped_state';
  equippedField.appendChild(equippedSelect);
  form.appendChild(equippedField);

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

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      user_id: character.user_id,
      character_id: character.id,
      name: formData.get('name'),
      qty: Number(formData.get('qty')),
      weight: Number(formData.get('weight')),
      value_cp: Number(formData.get('value_cp')),
      category: formData.get('category'),
      container_item_id: formData.get('container_item_id') || null,
      equipped_state: formData.get('equipped_state'),
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
