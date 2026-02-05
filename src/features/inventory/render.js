import { formatWeight } from '../../lib/format.js';
import {
  formatTransactionAmount,
  formatTransactionDate,
  getCategoryLabel,
  getItemStatusLabels
} from './utils.js';

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
    const usedVolume = children.reduce((total, entry) => {
      const volume = Number(entry.volume) || 0;
      const qty = Number(entry.qty) || 1;
      return total + volume * qty;
    }, 0);
    const maxVolume = Number(container.max_volume) || null;
    const volumeLabel = maxVolume
      ? `Volume ${usedVolume}/${maxVolume}`
      : usedVolume
        ? `Volume ${usedVolume}`
        : '';
    return `
      <div class="inventory-group">
        <p class="eyebrow">${container.name}${volumeLabel ? ` · <span class="muted">${volumeLabel}</span>` : ''}</p>
        ${buildItemList(children, weightUnit)}
      </div>
    `;
  }).join('');

  return `
    ${containerSections}
    <div class="inventory-group">
      ${buildItemList(topLevel, weightUnit)}
    </div>
  `;
}

export function buildItemList(items, weightUnit = 'lb') {
  if (!items.length) {
    return '<p class="muted eyebrow">Nessun oggetto.</p>';
  }
  return `
    <div class="inventory-table">
      <div class="inventory-table__header">
        <span>Oggetto</span>
        <span>Categoria</span>
        <span>Qtà</span>
        <span>Peso</span>
        <span>Volume</span>
        <span>Azioni</span>
      </div>
      <div class="inventory-table__body">
        ${items.map((item) => {
    const volumeValue = item.volume !== null && item.volume !== undefined ? item.volume : '-';
    const statusLabels = getItemStatusLabels(item);
    return `
          <div class="inventory-table__row">
            <div class="inventory-table__badges">
              ${item.is_magic ? `<span class="resource-chip resource-chip--floating resource-chip--magic">${statusLabels.magic}</span>` : ''}
              ${item.equipable ? `<span class="resource-chip resource-chip--floating resource-chip--equipable">${statusLabels.equipable}</span>` : ''}
              ${item.attunement_active ? `<span class="resource-chip resource-chip--floating resource-chip--attunement">${statusLabels.attunement}</span>` : ''}
            </div>
            <div class="inventory-table__cell inventory-table__cell--item">
              ${item.image_url ? `<img class="item-avatar" src="${item.image_url}" alt="Foto di ${item.name}" />` : ''}
              <div class="item-info-body">
                <strong>${item.name}</strong>
              </div>
            </div>
            <div class="inventory-table__cell">${getCategoryLabel(item.category)}</div>
            <div class="inventory-table__cell">${item.qty}</div>
            <div class="inventory-table__cell">${formatWeight(item.weight ?? 0, weightUnit)}</div>
            <div class="inventory-table__cell">${volumeValue}</div>
            <div class="inventory-table__cell inventory-table__cell--actions">
              ${item.category === 'consumable' ? `<button class="resource-action-button" data-use="${item.id}">Usa</button>` : ''}
              <button class="resource-action-button icon-button" data-edit="${item.id}" aria-label="Modifica" title="Modifica">
                <span aria-hidden="true">✏️</span>
              </button>
              <button class="resource-action-button icon-button" data-delete="${item.id}" aria-label="Elimina" title="Elimina">
                <span aria-hidden="true">🗑️</span>
              </button>
            </div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
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

export function exchangeFields({
  amount = 0,
  source = 'gp',
  target = 'pp',
  targetAmount = 0,
  available = {}
} = {}) {
  const entries = [
    { key: 'pp', label: 'Platino (PP)', value: Number(available.pp ?? 0) },
    { key: 'gp', label: 'Oro (GP)', value: Number(available.gp ?? 0) },
    { key: 'sp', label: 'Argento (SP)', value: Number(available.sp ?? 0) },
    { key: 'cp', label: 'Rame (CP)', value: Number(available.cp ?? 0) }
  ];
  const hasAvailable = entries.some((entry) => entry.value > 0);
  const sourceOptions = entries
    .filter((entry) => entry.value > 0)
    .map((entry) => `
          <option value="${entry.key}" ${source === entry.key ? 'selected' : ''}>${entry.label}</option>
        `).join('');
  const targetOptions = entries
    .map((entry) => `
          <option value="${entry.key}" ${target === entry.key ? 'selected' : ''}>${entry.label}</option>
        `).join('');
  return `
    <div class="modal-section">
      <h4 class="modal-section__title">Seleziona le monete da scambiare</h4>
      <div class="money-grid compact-grid-fields">
        <label class="field">
          <span>Tipo moneta</span>
          <select name="source" ${hasAvailable ? '' : 'disabled'}>
            ${hasAvailable ? sourceOptions : '<option value=\"\" selected>Nessuna moneta disponibile</option>'}
          </select>
        </label>
        <label class="field">
          <span>Quantità</span>
          <div class="field__input-row">
            <input name="amount" type="number" value="${amount}" min="0" step="1" ${hasAvailable ? '' : 'disabled'} />
            <button class="chip chip--small" type="button" data-exchange-max ${hasAvailable ? '' : 'disabled'}>Max</button>
          </div>
          <span class="field__hint muted" data-exchange-available></span>
        </label>
      </div>
    </div>
    <div class="modal-section">
      <h4 class="modal-section__title">Scegli la moneta di destinazione</h4>
      <div class="money-grid compact-grid-fields">
        <label class="field">
          <span>Moneta di destinazione</span>
          <select name="target">
            ${targetOptions}
          </select>
        </label>
        <label class="field">
          <span>Controvalore</span>
          <input name="target_amount" type="number" value="${targetAmount}" min="0" step="1" readonly />
        </label>
      </div>
    </div>
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
        <span>Volume</span>
        <input name="volume" type="number" value="0" min="0" step="0.1" />
      </label>
      <label class="field">
        <span>Valore (cp)</span>
        <input name="value_cp" type="number" value="0" />
      </label>
    </div>
  `;
}
