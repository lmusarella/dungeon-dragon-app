export function parseProficiencyNotes(notes) {
  if (!notes) return [];
  return notes
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseProficiencyNotesSections(notes) {
  if (!notes) {
    return { tools: [], languages: [] };
  }
  const normalized = notes.replace(/\r/g, '');
  const sectionRegex = /(lingue|lingua|strumenti|strumento)\s*:/gi;
  const sections = { tools: [], languages: [] };
  let lastIndex = 0;
  let lastKey = null;
  let match;
  const pushEntries = (key, chunk) => {
    if (!key || !chunk) return;
    const entries = chunk
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    sections[key].push(...entries);
  };
  while ((match = sectionRegex.exec(normalized)) !== null) {
    if (lastKey) {
      pushEntries(lastKey, normalized.slice(lastIndex, match.index));
    }
    lastKey = match[1].toLowerCase().startsWith('ling') ? 'languages' : 'tools';
    lastIndex = sectionRegex.lastIndex;
  }
  if (lastKey) {
    pushEntries(lastKey, normalized.slice(lastIndex));
    return sections;
  }
  return { tools: parseProficiencyNotes(notes), languages: [] };
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

export function getAbilityModifier(value) {
  const score = normalizeNumber(value);
  if (score === null) return null;
  return Math.floor((score - 10) / 2);
}

export function calculateSkillModifier(score, proficiencyBonus, proficiencyMultiplier) {
  const base = getAbilityModifier(score);
  if (base === null) return null;
  const bonus = proficiencyMultiplier > 0 && proficiencyBonus !== null
    ? proficiencyBonus * proficiencyMultiplier
    : 0;
  return base + bonus;
}

export function calculatePassivePerception(abilities, proficiencyBonus, skillStates, skillMasteryStates) {
  const hasProficiency = Boolean(skillStates.perception);
  const mastery = Boolean(skillMasteryStates.perception);
  const total = calculateSkillModifier(abilities.wis, proficiencyBonus, hasProficiency ? (mastery ? 2 : 1) : 0);
  if (total === null) return null;
  return 10 + total;
}

export function getHitDiceSides(hitDiceDie) {
  if (!hitDiceDie || typeof hitDiceDie !== 'string') return null;
  const match = hitDiceDie.trim().match(/d(\d+)/i);
  if (!match) return null;
  const sides = Number(match[1]);
  return Number.isNaN(sides) ? null : sides;
}

export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function parseDamageDice(damageDie) {
  if (!damageDie || typeof damageDie !== 'string') return null;
  const match = damageDie.trim().match(/(\d+)d(\d+)/i);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || !count || !sides) return null;
  return { count, sides };
}

export function formatSigned(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value >= 0 ? `+${value}` : `${value}`;
}

export function formatAbility(value) {
  if (value === null || value === undefined || value === '') return '-';
  const score = normalizeNumber(value);
  if (score === null) return '-';
  const modifier = formatModifier(score);
  return `${score} (${modifier})`;
}

export function formatModifier(score) {
  const mod = getAbilityModifier(score);
  return formatSigned(mod);
}

export function formatHitDice(hitDice) {
  if (!hitDice) return '-';
  const used = hitDice.used ?? '-';
  const max = hitDice.max ?? '-';
  const die = hitDice.die ? ` ${hitDice.die}` : '';
  if (used === '-' && max === '-' && !die) return '-';
  if (used === '-' || max === '-') {
    return `${used} / ${max}${die}`;
  }
  const remaining = Math.max(Number(max) - Number(used), 0);
  return `${remaining} / ${max}${die}`;
}

export function calculateArmorClass(data, abilities, items) {
  const equippedItems = (items || []).filter((item) => item.equipable && getEquipSlots(item).length);
  const dexMod = getAbilityModifier(abilities.dex) ?? 0;
  const acAbilityModifiers = data.ac_ability_modifiers || {};
  const extraMods = Object.keys(acAbilityModifiers)
    .filter((ability) => acAbilityModifiers[ability])
    .reduce((total, ability) => total + (getAbilityModifier(abilities[ability]) ?? 0), 0);
  const acBonus = normalizeNumber(data.ac_bonus) ?? 0;
  const armorCandidates = equippedItems.filter((item) => item.category === 'armor' && !item.is_shield);
  const shieldBonus = equippedItems
    .filter((item) => item.is_shield)
    .reduce((total, item) => total + (Number(item.shield_bonus) || 0), 0);
  const armorValues = armorCandidates.map((item) => {
    const base = Number(item.armor_class);
    if (!base) return null;
    const bonus = Number(item.armor_bonus) || 0;
    if (item.armor_type === 'heavy') return base + bonus;
    if (item.armor_type === 'medium') return base + bonus + Math.min(dexMod, 2);
    return base + bonus + dexMod;
  }).filter((value) => value !== null);
  const armorValue = armorValues.length ? Math.max(...armorValues) : null;
  const fallbackBase = normalizeNumber(data.ac);
  const base = armorValue ?? fallbackBase ?? (10 + dexMod + extraMods);
  return base + shieldBonus + acBonus;
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

export function formatResourceRecovery(resource) {
  const maxUses = Number(resource.max_uses) || 0;
  if (maxUses === 0) return 'Passiva';
  const shortRecovery = Number(resource.recovery_short);
  const longRecovery = Number(resource.recovery_long);
  const hasShort = !Number.isNaN(shortRecovery) && shortRecovery > 0;
  const hasLong = !Number.isNaN(longRecovery) && longRecovery > 0;
  if ((resource.reset_on === 'none' || resource.reset_on === null) && !hasShort && !hasLong) {
    return 'Nessuna ricarica';
  }
  if (!hasShort && !hasLong) {
    return resource.reset_on === 'short_rest'
      ? 'Recupera tutte le cariche (riposo breve)'
      : 'Recupera tutte le cariche (riposo lungo)';
  }
  const parts = [];
  if (hasShort) parts.push(`Riposo breve +${shortRecovery}`);
  if (hasLong) parts.push(`Riposo lungo +${longRecovery}`);
  return parts.join(' · ');
}

export function sortSpellsByLevel(spells) {
  return [...spells].sort((a, b) => {
    const levelDiff = Number(a.level) - Number(b.level);
    if (levelDiff !== 0) return levelDiff;
    return (a.name ?? '').localeCompare(b.name ?? '', 'it', { sensitivity: 'base' });
  });
}

export function getSpellTypeLabel(spell) {
  const isCantrip = spell.kind === 'cantrip' || Number(spell.level) === 0;
  return isCantrip ? 'Trucchetto' : 'Incantesimo';
}

export function buildWeaponDamageOverlayConfig(character, weapon) {
  if (!character || !weapon) return null;
  const data = character.data || {};
  const weaponRange = weapon.weapon_range || (weapon.range_normal ? 'ranged' : 'melee');
  const attackAbility = weapon.attack_ability
    || (weaponRange === 'ranged' ? 'dex' : 'str');
  const abilityMod = getAbilityModifier(data.abilities?.[attackAbility]) ?? 0;
  const damageBonusMelee = Number(data.damage_bonus_melee ?? data.damage_bonus) || 0;
  const damageBonusRanged = Number(data.damage_bonus_ranged ?? data.damage_bonus) || 0;
  const damageBonus = weaponRange === 'ranged' ? damageBonusRanged : damageBonusMelee;
  const damageTotal = abilityMod + (Number(weapon.damage_modifier) || 0) + damageBonus;
  const dice = parseDamageDice(weapon.damage_die);
  if (!dice) return null;
  return {
    title: `Danni ${weapon.name}`,
    notation: `${dice.count}d${dice.sides}`,
    modifier: damageTotal
  };
}

export function buildSpellDamageOverlayConfig(spell) {
  if (!spell) return null;
  const dice = parseDamageDice(spell.damage_die);
  if (!dice) return null;
  const damageModifier = Number(spell.damage_modifier) || 0;
  return {
    title: `Danni ${spell.name}`,
    notation: `${dice.count}d${dice.sides}`,
    modifier: damageModifier
  };
}

function applyLongRestHitDice(data) {
  if (!data) return null;
  const hitDice = data.hit_dice || {};
  const max = Number(hitDice.max) || 0;
  const used = Number(hitDice.used) || 0;
  if (!max || !used) return null;
  const recovery = Math.floor(max / 2);
  if (!recovery) return null;
  const nextUsed = Math.max(used - Math.min(recovery, used), 0);
  if (nextUsed === used) return null;
  return {
    ...hitDice,
    used: nextUsed
  };
}

function applyLongRestRecovery(data) {
  if (!data) return null;
  let changed = false;
  const hp = data.hp || {};
  const maxHp = normalizeNumber(hp.max);
  const next = { ...data };
  if (maxHp !== null && maxHp !== undefined) {
    const currentHp = Number(hp.current) || 0;
    if (currentHp !== maxHp) {
      next.hp = {
        ...hp,
        current: maxHp
      };
      changed = true;
    }
  }
  const nextHitDice = applyLongRestHitDice(data);
  if (nextHitDice) {
    next.hit_dice = nextHitDice;
    changed = true;
  }
  return changed ? next : null;
}

export function applyRestRecovery(data, resetOn) {
  if (!data) return null;
  let next = data;
  if (resetOn === 'long_rest') {
    next = applyLongRestRecovery(data) || data;
  }
  const spellSlotRecovery = applySpellSlotRecovery(next, resetOn);
  if (spellSlotRecovery) {
    next = spellSlotRecovery;
  }
  return next === data ? null : next;
}

function applySpellSlotRecovery(data, resetOn) {
  if (!data) return null;
  const spellcasting = data.spellcasting || {};
  if (!spellcasting || !spellcasting.slots) return null;
  const recharge = spellcasting.recharge || 'long_rest';
  const shouldRecover = resetOn === 'long_rest' || recharge === 'short_rest';
  if (!shouldRecover) return null;
  const slotLevels = Array.from({ length: 9 }, (_, index) => index + 1);
  const slots = { ...(spellcasting.slots || {}) };
  const slotsMax = { ...(spellcasting.slots_max || {}) };
  let changed = false;
  slotLevels.forEach((level) => {
    const current = Math.max(0, Number(slots[level]) || 0);
    const maxValue = Number(slotsMax[level]);
    const nextMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : current;
    if (nextMax !== maxValue) {
      slotsMax[level] = nextMax;
      changed = true;
    }
    if (nextMax > 0 && current !== nextMax) {
      slots[level] = nextMax;
      changed = true;
    }
  });
  if (!changed) return null;
  return {
    ...data,
    spellcasting: {
      ...spellcasting,
      slots,
      slots_max: slotsMax
    }
  };
}

export function calculateWeaponDamageRoll(character, weapon) {
  if (!character || !weapon) return null;
  const data = character.data || {};
  const weaponRange = weapon.weapon_range || (weapon.range_normal ? 'ranged' : 'melee');
  const attackAbility = weapon.attack_ability
    || (weaponRange === 'ranged' ? 'dex' : 'str');
  const abilityMod = getAbilityModifier(data.abilities?.[attackAbility]) ?? 0;
  const damageBonusMelee = Number(data.damage_bonus_melee ?? data.damage_bonus) || 0;
  const damageBonusRanged = Number(data.damage_bonus_ranged ?? data.damage_bonus) || 0;
  const damageBonus = weaponRange === 'ranged' ? damageBonusRanged : damageBonusMelee;
  const damageTotal = abilityMod + (Number(weapon.damage_modifier) || 0) + damageBonus;
  const dice = parseDamageDice(weapon.damage_die);
  if (!dice) return null;
  const rolls = Array.from({ length: dice.count }, () => rollDie(dice.sides));
  const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
  const total = diceTotal + damageTotal;
  const bonusLabel = damageTotal ? ` ${formatSigned(damageTotal)}` : '';
  return {
    total,
    label: `${weapon.name} (${dice.count}d${dice.sides}: ${rolls.join(' + ')}${bonusLabel})`
  };
}

export function calculateSpellDamageRoll(spell) {
  if (!spell) return null;
  const dice = parseDamageDice(spell.damage_die);
  if (!dice) return null;
  const damageModifier = Number(spell.damage_modifier) || 0;
  const rolls = Array.from({ length: dice.count }, () => rollDie(dice.sides));
  const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
  const total = diceTotal + damageModifier;
  const bonusLabel = damageModifier ? ` ${formatSigned(damageModifier)}` : '';
  return {
    total,
    label: `${spell.name} (${dice.count}d${dice.sides}: ${rolls.join(' + ')}${bonusLabel})`
  };
}
