export function calcTotalWeight(items = []) {
  return items.reduce((total, item) => {
    const qty = Number(item.qty ?? 0);
    const weight = Number(item.weight ?? 0);
    return total + qty * weight;
  }, 0);
}

export function applyMoneyDelta(wallet, delta) {
  const next = { ...wallet };
  Object.keys(delta).forEach((coin) => {
    next[coin] = Number(next[coin] ?? 0) + Number(delta[coin] ?? 0);
  });
  return next;
}
