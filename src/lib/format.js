export function formatWeight(value, unit = 'lb') {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  const weight = Number(value);
  return `${weight.toFixed(2).replace(/\.00$/, '')} ${unit}`;
}

export function formatCoin(value, label) {
  const amount = Number(value ?? 0);
  return `${amount} ${label}`;
}

export function formatWallet(wallet, unit = 'gp') {
  if (!wallet) return '-';
  const entries = ['pp', 'gp', 'ep', 'sp', 'cp'];
  return entries
    .map((coin) => `${wallet[coin] ?? 0} ${coin}`)
    .join(' · ');
}
