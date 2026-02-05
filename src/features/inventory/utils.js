import { bodyPartLabels, categoryLabels } from './constants.js';
import { formatCoin } from '../../lib/format.js';

export function formatTransactionAmount(amount) {
  const normalized = normalizeTransactionAmount(amount);
  const entries = ['pp', 'gp', 'sp', 'cp']
    .map((coin) => ({ coin, value: Number(normalized?.[coin] ?? 0) }))
    .filter((entry) => entry.value !== 0);
  if (!entries.length) return '0 gp';
  return entries.map((entry) => formatCoin(entry.value, entry.coin)).join(' · ');
}

export function normalizeTransactionAmount(amount) {
  if (!amount) return {};
  if (typeof amount === 'string') {
    try {
      return JSON.parse(amount);
    } catch (error) {
      return {};
    }
  }
  return amount;
}

export function formatTransactionDate(value) {
  if (!value) return 'Data non disponibile';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data non disponibile';
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function getCategoryLabel(category) {
  return categoryLabels.get(category) ?? (category ? category : 'Altro');
}

export function getBodyPartLabel(part) {
  return bodyPartLabels.get(part) ?? part;
}

export function getBodyPartLabels(parts) {
  return parts.map((part) => getBodyPartLabel(part)).join(', ');
}

export function getEquipSlots(item) {
  if (!item) return [];
  if (Array.isArray(item.equip_slots)) {
    return item.equip_slots.filter(Boolean);
  }
  if (typeof item.equip_slots === 'string' && item.equip_slots.trim()) {
    try {
      const parsed = JSON.parse(item.equip_slots);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (error) {
      return [item.equip_slots];
    }
  }
  if (item.equip_slot) return [item.equip_slot];
  return [];
}

export function getWeightUnit(character) {
  return character.data?.settings?.weight_unit ?? 'lb';
}

export function getItemStatusLabels(item = {}) {
  return {
    magic: item.is_magic ? 'Magico' : 'Non magico',
    equipable: item.equipable ? 'Equipaggiabile' : 'Non equipaggiabile',
    attunement: item.attunement_active ? 'In sintonia' : 'Non in sintonia'
  };
}

export function hasProficiencyForItem(character, formData) {
  const proficiencies = character.data?.proficiencies || {};
  const category = formData.get('category');
  if (category === 'weapon') {
    const weaponType = formData.get('weapon_type');
    if (!weaponType) return false;
    return weaponType === 'simple'
      ? Boolean(proficiencies.weapon_simple)
      : Boolean(proficiencies.weapon_martial);
  }
  if (category === 'armor') {
    const isShield = formData.get('is_shield') === 'on';
    if (isShield) {
      return Boolean(proficiencies.shield);
    }
    const armorType = formData.get('armor_type');
    if (!armorType) return false;
    if (armorType === 'light') return Boolean(proficiencies.armor_light);
    if (armorType === 'medium') return Boolean(proficiencies.armor_medium);
    return Boolean(proficiencies.armor_heavy);
  }
  return true;
}
