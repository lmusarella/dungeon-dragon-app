import { formatWallet } from '../../lib/format.js';

export function renderWalletSummary(wallet) {
  const coins = [
    { key: 'pp', label: 'Platino' },
    { key: 'gp', label: 'Oro' },
    { key: 'sp', label: 'Argento' },
    { key: 'cp', label: 'Rame' }
  ];
  return `
    <div class="wallet-summary">     
      <div class="wallet-grid">
        ${coins.map((coin) => `
          <div class="stat-card">
            <span class="coin-avatar coin-avatar--${coin.key}" aria-hidden="true"></span>
            <span>${coin.label}</span>
            <strong>${wallet?.[coin.key] ?? 0}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
