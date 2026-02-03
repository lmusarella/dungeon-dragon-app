export function renderWalletSummary(wallet) {
  const baseUrl = import.meta.env.BASE_URL;
  const coins = [
    { key: 'pp', label: 'Platino', icon: `${baseUrl}icons/moneta_platino.png` },
    { key: 'gp', label: 'Oro', icon: `${baseUrl}icons/moneta_oro.png` },
    { key: 'sp', label: 'Argento', icon: `${baseUrl}icons/moneta_argento.png` },
    { key: 'cp', label: 'Rame', icon: `${baseUrl}icons/moneta_rame.png` }
  ];
  return `
    <div class="wallet-summary">     
      <div class="wallet-grid">
        ${coins.map((coin) => `
          <div class="stat-card">
            <span class="coin-avatar coin-avatar--${coin.key}" aria-hidden="true">
              <img src="${coin.icon}" alt="" loading="lazy" />
            </span>
            <span>${coin.label}</span>
            <strong>${wallet?.[coin.key] ?? 0}</strong>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
