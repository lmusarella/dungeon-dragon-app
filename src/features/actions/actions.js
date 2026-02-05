import { getState, normalizeCharacterId, updateCache } from '../../app/state.js';
import { fetchWallet, upsertWallet, createTransaction } from '../wallet/walletApi.js';
import { renderWalletSummary } from '../wallet/wallet.js';
import { applyMoneyDelta } from '../../lib/calc.js';
import { createToast } from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { createItem } from '../inventory/inventoryApi.js';

export async function renderActions(container) {
  const state = getState();
  const normalizedActiveId = normalizeCharacterId(state.activeCharacterId);
  const activeCharacter = state.characters.find((char) => normalizeCharacterId(char.id) === normalizedActiveId);
  if (!activeCharacter) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  let wallet = state.cache.wallet;
  if (!state.offline) {
    try {
      wallet = await fetchWallet(activeCharacter.id);
      updateCache('wallet', wallet);
      if (wallet) await cacheSnapshot({ wallet });
    } catch (error) {
      createToast('Errore caricamento wallet', 'error');
    }
  }

  container.innerHTML = `
    <section class="card">
      ${renderWalletSummary(wallet)}
    </section>
    <section class="card">
      <h3>Azioni denaro</h3>
      <div class="action-grid">
        <form data-money-form="pay">
          <h4>Paga</h4>
          ${moneyFields()}
          <button class="primary" type="submit">Paga</button>
        </form>
        <form data-money-form="receive">
          <h4>Ricevi</h4>
          ${moneyFields()}
          <button class="primary" type="submit">Ricevi</button>
        </form>
      </div>
    </section>
    <section class="card">
      <h3>Loot rapido</h3>
      <form data-loot-form>
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
          <input name="weight" type="number" value="0" />
        </label>
        <label class="field">
          <span>Volume</span>
          <input name="volume" type="number" value="0" />
        </label>
        <label class="field">
          <span>Valore (cp)</span>
          <input name="value_cp" type="number" value="0" />
        </label>
        <button class="primary" type="submit">Aggiungi</button>
      </form>
    </section>
  `;

  container.querySelectorAll('[data-money-form]')
    .forEach((form) => form.addEventListener('submit', async (event) => {
      event.preventDefault();
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
      const direction = form.dataset.moneyForm;
      const formData = new FormData(form);
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
        renderActions(container);
      } catch (error) {
        createToast('Errore aggiornamento denaro', 'error');
      }
    }));

  const lootForm = container.querySelector('[data-loot-form]');
  lootForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(lootForm);
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
      lootForm.reset();
    } catch (error) {
      createToast('Errore loot', 'error');
    }
  });
}

function moneyFields() {
  return `
    <div class="money-grid">
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
