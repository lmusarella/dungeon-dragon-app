import { formatWallet } from '../../lib/format.js';

export function renderWalletSummary(wallet) {
  return `
    <div class="wallet-summary">
      <h3>Wallet</h3>
      <p>${formatWallet(wallet)}</p>
      <div class="wallet-grid">
        ${['pp', 'gp', 'ep', 'sp', 'cp'].map((coin) => `
          <div class="stat-card">
            <span>${coin.toUpperCase()}</span>
            <strong>${wallet?.[coin] ?? 0}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
