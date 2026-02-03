import { formatWeight } from '../../lib/format.js';
import { formatTransactionAmount, formatTransactionDate, getBodyPartLabels, getCategoryLabel, getEquipSlots } from './utils.js';

export function buildTransactionList(transactions) {
  const wrapper = document.createElement('div');
  wrapper.className = 'transaction-list transaction-ledger';
  if (!transactions.length) {
    wrapper.innerHTML = '<p class="muted">Nessuna transazione registrata.</p>';
    return wrapper;
  }
  wrapper.innerHTML = `
    <div class="transaction-ledger-header">
      <span>Descrizione</span>
      <span>Importo</span>
    </div>
  `;
  const list = document.createElement('ul');
  list.className = 'transaction-items';
  transactions.forEach((transaction) => {
    const item = document.createElement('li');
    const directionLabel = transaction.direction === 'pay' ? 'Pagamento' : 'Entrata';
    const amountLabel = formatTransactionAmount(transaction.amount);
    const dateLabel = formatTransactionDate(transaction.occurred_on || transaction.created_at);
    item.innerHTML = `
      <div class="transaction-info">
        <strong>${directionLabel}</strong>
        <p class="muted">${transaction.reason || 'Nessuna nota'} · ${dateLabel}</p>
      </div>
      <div class="transaction-meta">
        <span class="transaction-amount">${amountLabel}</span>
        <div class="transaction-actions">
          <button class="icon-button" type="button" data-edit-transaction="${transaction.id}" aria-label="Modifica transazione" title="Modifica">
            <span aria-hidden="true">✏️</span>
          </button>
          <button class="icon-button icon-button--danger" type="button" data-delete-transaction="${transaction.id}" aria-label="Elimina transazione" title="Elimina">
            <span aria-hidden="true">🗑️</span>
          </button>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
  wrapper.appendChild(list);
  return wrapper;
}

export function buildInventoryTree(items, weightUnit = 'lb') {
  const containers = items.filter((item) => item.category === 'container');
  const topLevel = items.filter((item) => !item.container_item_id && item.category !== 'container');

  const containerSections = containers.map((container) => {
    const children = items.filter((item) => item.container_item_id === container.id);
    return `
      <div class="inventory-group">
        <p class="eyebrow">${container.name}</p>
        ${buildItemList(children, weightUnit)}
      </div>
    `;
  }).join('');

  return `
    ${containerSections}
    <div class="inventory-group">
      <p class="eyebrow">Oggetti</p>
      ${buildItemList(topLevel, weightUnit)}
    </div>
  `;
}

export function buildItemList(items, weightUnit = 'lb') {
  if (!items.length) {
    return '<p class="muted eyebrow">Nessun oggetto.</p>';
  }
  return `
    <ul class="inventory-list resource-list resource-list--compact">
      ${items.map((item) => `
        <li class="modifier-card attack-card resource-card inventory-item-card">
          <div class="attack-card__body resource-card__body">
            <div class="resource-card__title item-info">
              ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
              <div class="item-info-body">
                <div class="item-info-line">
                  <strong class="attack-card__name">${item.name}</strong>
                  <span class="muted item-meta">
                    ${getCategoryLabel(item.category)} · ${item.qty}x · ${formatWeight(item.weight ?? 0, weightUnit)}
                  </span>
                </div>
                <div class="tag-row resource-card__meta">
                  ${item.equipable ? `<span class="chip">equipaggiabile${getEquipSlots(item).length ? ` · ${getBodyPartLabels(getEquipSlots(item))}` : ''}</span>` : ''}
                  ${item.sovrapponibile ? '<span class="chip">sovrapponibile</span>' : ''}
                  ${item.attunement_active ? '<span class="chip">attuned</span>' : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="resource-card-actions">
            ${item.category === 'consumable' ? `<button class="resource-action-button" data-use="${item.id}">Usa</button>` : ''}
            <button class="resource-action-button icon-button" data-edit="${item.id}" aria-label="Modifica" title="Modifica">
              <span aria-hidden="true">✏️</span>
            </button>
            <button class="resource-action-button icon-button" data-delete="${item.id}" aria-label="Elimina" title="Elimina">
              <span aria-hidden="true">🗑️</span>
            </button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

export function buildEquippedList(items) {
  if (!items.length) return '';
  return `
    <ul class="inventory-list resource-list resource-list--compact">
      ${items.map((item) => `
        <li class="modifier-card attack-card resource-card inventory-item-card">
          <div class="attack-card__body resource-card__body">
            <div class="resource-card__title item-info">
              ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
              <div class="item-info-body">
                <div class="item-info-line">
                  <strong class="attack-card__name">${item.name}</strong>
                  <span class="muted item-meta">
                    ${getCategoryLabel(item.category)} · ${getBodyPartLabels(getEquipSlots(item))}
                  </span>
                </div>
                <div class="tag-row resource-card__meta">
                  ${item.attunement_active ? '<span class="chip">attuned</span>' : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="resource-card-actions">
            <button class="resource-action-button" data-unequip="${item.id}">Rimuovi</button>
            <button class="resource-action-button" data-attune="${item.id}">
              ${item.attunement_active ? 'Disattiva attune' : 'Attiva attune'}
            </button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

export function moneyFields({ amount = 0, coin = 'gp', reason = '', occurredOn, direction = 'receive', includeDirection = false } = {}) {
  const resolvedDate = occurredOn || new Date().toISOString().split('T')[0];
  return `
    <div class="money-grid compact-grid-fields">
      <label class="field">
        <span>Quantità</span>
        <input name="amount" type="number" value="${amount}" min="0" />
      </label>
      <label class="field">
        <span>Tipo moneta</span>
        <select name="coin">
          <option value="pp" ${coin === 'pp' ? 'selected' : ''}>Platino (PP)</option>
          <option value="gp" ${coin === 'gp' ? 'selected' : ''}>Oro (GP)</option>
          <option value="sp" ${coin === 'sp' ? 'selected' : ''}>Argento (SP)</option>
          <option value="cp" ${coin === 'cp' ? 'selected' : ''}>Rame (CP)</option>
        </select>
      </label>
    </div>
    ${includeDirection ? `
      <label class="field">
        <span>Direzione</span>
        <select name="direction">
          <option value="receive" ${direction === 'receive' ? 'selected' : ''}>Entrata</option>
          <option value="pay" ${direction === 'pay' ? 'selected' : ''}>Pagamento</option>
        </select>
      </label>
    ` : ''}
    <label class="field">
      <span>Motivo</span>
      <input name="reason" placeholder="Motivo" value="${reason}" />
    </label>
    <label class="field">
      <span>Data</span>
      <input name="occurred_on" type="date" value="${resolvedDate}" />
    </label>
  `;
}

export function buildLootFields(weightStep) {
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
