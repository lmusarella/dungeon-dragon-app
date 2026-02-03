import {
  abilityShortLabel,
  equipmentProficiencyList,
  RESOURCE_CAST_TIME_ORDER,
  savingThrowList,
  skillList
} from './constants.js';
import {
  calculateArmorClass,
  calculatePassivePerception,
  calculateSkillModifier,
  formatHitDice,
  formatModifier,
  formatSigned,
  getAbilityModifier,
  getEquipSlots,
  normalizeNumber,
  parseProficiencyNotes,
  parseProficiencyNotesSections
} from './utils.js';
import { getBodyPartLabels, getCategoryLabel } from '../../inventory/utils.js';

export function buildEmptyState(canCreateCharacter, offline) {
  if (!canCreateCharacter) {
    const message = offline
      ? 'Modalità offline attiva: crea un personaggio quando torni online.'
      : 'Accedi per creare un personaggio.';
    return `<p class="muted">${message}</p>`;
  }
  return `
    <div>
      <p>Non hai ancora un personaggio.</p>
      <div class="button-row">
        <button class="primary" data-create-character>Nuovo personaggio</button>
      </div>
    </div>
  `;
}

export function buildCharacterOverview(character, canEditCharacter, items = []) {
  const data = character.data || {};
  const hp = data.hp || {};
  const hitDice = data.hit_dice || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const hasInspiration = Boolean(data.inspiration);
  const initiativeBonus = data.initiative ?? getAbilityModifier(abilities.dex);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};
  const passivePerception = calculatePassivePerception(abilities, proficiencyBonus, skillStates, skillMasteryStates);
  const currentHp = normalizeNumber(hp.current);
  const maxHp = normalizeNumber(hp.max);
  const tempHp = normalizeNumber(hp.temp);
  const deathSaves = data.death_saves || {};
  const deathSaveSuccesses = Math.max(0, Math.min(3, Number(deathSaves.successes) || 0));
  const deathSaveFailures = Math.max(0, Math.min(3, Number(deathSaves.failures) || 0));
  const hpPercent = maxHp ? Math.min(Math.max((Number(currentHp) / maxHp) * 100, 0), 100) : 0;
  const tempHpValue = Math.max(0, Number(tempHp) || 0);
  const hpPool = Math.max(0, Number(maxHp ?? currentHp ?? 0));
  const hasTempHp = tempHpValue > 0;
  const tempHpPercent = hasTempHp ? 100 : 0;
  const hpTrackFlex = hasTempHp ? hpPool : 1;
  const tempTrackFlex = hasTempHp ? tempHpValue : 0;
  const hpLabel = maxHp ? `${currentHp ?? '-'}/${maxHp}` : `${currentHp ?? '-'}`;
  const tempHpLabel = tempHp ?? '-';
  const weakPoints = Math.max(0, Math.min(6, Number(hp.weak_points) || 0));
  const weaknessLevels = [
    { value: 1, description: 'Svantaggio sulle prove di caratteristica.' },
    { value: 2, description: 'Velocità dimezzata.' },
    { value: 3, description: 'Svantaggio sui tiri per colpire e tiri salvezza.' },
    { value: 4, description: 'Punti ferita massimi dimezzati.' },
    { value: 5, description: 'Velocità ridotta a 0.' },
    { value: 6, description: 'Morte.' }
  ];
  const weaknessDescription = weaknessLevels.find((level) => level.value === weakPoints)?.description || 'Nessun indebolimento.';
  const armorClass = calculateArmorClass(data, abilities, items);
  const abilityCards = [
    { key: 'str', label: abilityShortLabel.str, value: abilities.str },
    { key: 'dex', label: abilityShortLabel.dex, value: abilities.dex },
    { key: 'con', label: abilityShortLabel.con, value: abilities.con },
    { key: 'int', label: abilityShortLabel.int, value: abilities.int },
    { key: 'wis', label: abilityShortLabel.wis, value: abilities.wis },
    { key: 'cha', label: abilityShortLabel.cha, value: abilities.cha }
  ];
  return `
    <div class="character-overview">
      <div class="character-summary">
        <div class="character-hero">
          ${data.avatar_url ? `<img class="character-avatar" src="${data.avatar_url}" alt="Ritratto di ${character.name}" />` : ''}
          <div>
            <h3 class="character-name">${character.name}</h3>
            <div class="character-meta">
              <span class="meta-tag">Livello ${data.level ?? '-'}</span>
              <span class="meta-tag">Razza ${data.race ?? '-'}</span>
              <span class="meta-tag">Classe ${data.class_name ?? data.class_archetype ?? '-'}</span>
              <span class="meta-tag">Archetipo ${data.archetype ?? '-'}</span>
              <span class="meta-tag">Allineamento ${data.alignment ?? '-'}</span>
              <span class="meta-tag">Background ${data.background ?? '-'}</span>
            </div>
          </div>
        </div>
        <div class="character-summary-actions">
          <div class="proficiency-chip">
            <span>Bonus competenza</span>
            <strong>${formatSigned(proficiencyBonus)}</strong>
          </div>
          <div class="inspiration-chip">
            <span>Ispirazione</span>
            <button
              class="inspiration-toggle"
              type="button"
              data-toggle-inspiration
              aria-pressed="${hasInspiration}"
              aria-label="Imposta ispirazione"
              ${canEditCharacter ? '' : 'disabled'}
            >
              <span class="inspiration-toggle__icon" aria-hidden="true">★</span>
            </button>
          </div>
          <button class="ghost-button background-button" type="button" data-show-background>
            Background
          </button>
        </div>
      </div>
      <div class="stat-panel">     
        <div class="stat-grid stat-grid--compact stat-grid--abilities">
          ${abilityCards.map((ability) => {
    const score = normalizeNumber(ability.value);
    const modifier = score === null ? '-' : formatModifier(score);
    return `
            <div class="stat-card stat-card--${ability.key}">
              <span>${ability.label}</span>
              <strong>${score ?? '-'}</strong>
              <span class="stat-card__modifier" aria-label="Modificatore ${ability.label}">${modifier}</span>
            </div>
          `;
  }).join('')}
        </div>
      </div>
      <div class="hp-panel">
        <div class="hp-bar-row">
          <div class="armor-class-card">
            <span>CA</span>
            <strong>${armorClass ?? '-'}</strong>
            <span class="armor-class-card__sigil" aria-hidden="true">🛡️</span>
          </div>
          <div class="armor-class-card armor-class-card--initiative">
            <span>Iniz</span>
            <strong>${formatSigned(normalizeNumber(initiativeBonus))}</strong>
            <span class="armor-class-card__sigil" aria-hidden="true">⚡</span>
          </div>
          <div class="armor-class-card armor-class-card--speed">
            <span>Vel</span>
            <strong>${data.speed ?? '-'}</strong>
            <span class="armor-class-card__sigil" aria-hidden="true">🏃</span>
          </div>
          <div class="hp-bar-stack">
            <div class="hp-bar-label">
              <span>HP</span>
              <strong>${hpLabel}</strong>
              <span class="hp-bar-label__divider" aria-hidden="true">•</span>
              <span class="hp-bar-label__temp-group ${hasTempHp ? 'is-active' : ''}">
                <span class="hp-bar-label__temp">HP temporanei</span>
                <strong>${tempHpLabel}</strong>
              </span>
            </div>
            <div class="hp-bar-track">
              <div class="hp-bar" style="flex: ${hpTrackFlex};">
                <div class="hp-bar__fill" style="width: ${hpPercent}%;"></div>
              </div>
              ${hasTempHp ? `
              <div class="hp-bar hp-bar--temp is-active" style="flex: ${tempTrackFlex};">
                <div class="hp-bar__fill hp-bar__fill--temp" style="width: ${tempHpPercent}%;"></div>
              </div>
              ` : ''}
            </div>
            <div class="hp-panel-hit-dice">
              <span>Dadi vita</span>
              <strong>${formatHitDice(hitDice)}</strong>
            </div>
          </div>
        </div>
        <div class="hp-panel-subgrid">
          <div class="stat-chip stat-chip--highlight">
            <span>Percezione passiva</span>
            <strong>${passivePerception ?? '-'}</strong>
          </div>
          <div class="hp-panel-status-row">
            <div class="weakness-track">
              <span class="weakness-track__label">Punti indebolimento</span>
              <div class="weakness-track__group" role="radiogroup" aria-label="Livelli indebolimento">
                ${weaknessLevels.map((level) => {
    const isFilled = level.value === weakPoints;
    return `
                  <button
                    class="death-save-dot ${isFilled ? 'is-filled' : ''}"
                    type="button"
                    role="radio"
                    aria-checked="${isFilled}"
                    data-weakness-level="${level.value}"
                    aria-label="Livello ${level.value}: ${level.description}"
                  >
                    <span aria-hidden="true"></span>
                  </button>
                `;
  }).join('')}
              </div>
              <span class="weakness-track__description">${weaknessDescription}</span>
            </div>
            <div class="death-saves">
              <span class="death-saves__label">TS morte</span>
              <div class="death-saves__group" aria-label="Successi">
                <span class="death-saves__tag">✓</span>
                ${Array.from({ length: 3 }, (_, index) => {
    const value = index + 1;
    const isFilled = value <= deathSaveSuccesses;
    return `
                  <button class="death-save-dot ${isFilled ? 'is-filled' : ''}" type="button" data-death-save="successes" data-death-save-index="${value}" aria-label="Successi ${value}">
                    <span aria-hidden="true"></span>
                  </button>
                `;
  }).join('')}
              </div>
              <div class="death-saves__group" aria-label="Fallimenti">
                <span class="death-saves__tag">✗</span>
                ${Array.from({ length: 3 }, (_, index) => {
    const value = index + 1;
    const isFilled = value <= deathSaveFailures;
    return `
                  <button class="death-save-dot ${isFilled ? 'is-filled' : ''}" type="button" data-death-save="failures" data-death-save-index="${value}" aria-label="Fallimenti ${value}">
                    <span aria-hidden="true"></span>
                  </button>
                `;
  }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="home-section">
        <header class="card-header">
          <div>
            <p class="eyebrow">Competenze extra</p>
          </div>
        </header>
        ${buildProficiencyOverview(character, items, canEditCharacter)}
      </div>
    </div>
  `;
}

export function buildSkillList(character) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};

  return `
    <div class="detail-section">
      <div class="detail-grid detail-grid--compact">
        ${skillList.map((skill) => {
    const proficient = Boolean(skillStates[skill.key]);
    const mastery = Boolean(skillMasteryStates[skill.key]);
    const total = calculateSkillModifier(abilities[skill.ability], proficiencyBonus, proficient ? (mastery ? 2 : 1) : 0);
    const statusClass = mastery ? 'modifier-card--mastery' : proficient ? 'modifier-card--proficiency' : '';
    return `
          <div class="modifier-card ${statusClass}">
            <div>
              <div class="modifier-title">
                <strong>${skill.label}</strong>
                <span class="modifier-ability modifier-ability--${skill.ability}">${abilityShortLabel[skill.ability]}</span>
              </div>
            </div>
            <div class="modifier-value">${formatSigned(total)}</div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}

export function buildSavingThrowSection(character) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const savingStates = data.saving_throws || {};

  return `
    <div class="detail-section">
      <div class="detail-grid detail-grid--compact">
        ${savingThrowList.map((save) => {
    const proficient = Boolean(savingStates[save.key]);
    const total = calculateSkillModifier(abilities[save.key], proficiencyBonus, proficient ? 1 : 0);
    const statusClass = proficient ? 'modifier-card--proficiency' : '';
    return `
          <div class="modifier-card ${statusClass}">
            <div>
              <div class="modifier-title">
                <strong>${save.label}</strong>
              </div>
            </div>
            <div class="modifier-value">${formatSigned(total)}</div>
          </div>
        `;
  }).join('')}
      </div>
    </div>
  `;
}

export function buildProficiencyOverview(character, items = [], canEditCharacter = false) {
  const data = character.data || {};
  const proficiencies = data.proficiencies || {};
  const notes = data.proficiency_notes || '';
  const { tools, languages: legacyLanguages } = parseProficiencyNotesSections(notes);
  const languageNotes = data.language_proficiencies || '';
  const explicitLanguages = parseProficiencyNotes(languageNotes);
  const talentNotes = data.talents || '';
  const talents = parseProficiencyNotes(talentNotes);
  const combinedLanguages = [...explicitLanguages, ...legacyLanguages];
  const languages = combinedLanguages.reduce((acc, entry) => {
    const cleaned = entry.trim();
    if (!cleaned) return acc;
    const key = cleaned.toLowerCase();
    if (acc.seen.has(key)) return acc;
    acc.seen.add(key);
    acc.values.push(cleaned);
    return acc;
  }, { values: [], seen: new Set() }).values;
  const equipped = equipmentProficiencyList
    .filter((prof) => proficiencies[prof.key])
    .map((prof) => prof.label);
  const equippedItems = (items || []).filter((item) => getEquipSlots(item).length);
  const attunedCount = (items || []).filter((item) => item.attunement_active).length;
  return `
    <div class="detail-section">
      <div class="proficiency-tabs" data-proficiency-tabs>
        <div class="tab-bar" role="tablist" aria-label="Competenze extra">
          <button class="tab-bar__button is-active" type="button" role="tab" aria-selected="true" data-proficiency-tab="equipment">
            Equipaggiamento
          </button>
          <button class="tab-bar__button" type="button" role="tab" aria-selected="false" data-proficiency-tab="tools">
            Strumenti
          </button>
          <button class="tab-bar__button" type="button" role="tab" aria-selected="false" data-proficiency-tab="languages">
            Lingue
          </button>
          <button class="tab-bar__button" type="button" role="tab" aria-selected="false" data-proficiency-tab="talents">
            Talenti
          </button>
        </div>
        <div class="detail-card detail-card--text tab-panel is-active" role="tabpanel" data-proficiency-panel="equipment">
          ${equipped.length
    ? `<div class="tag-row">${equipped.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Nessuna competenza equipaggiamento.</p>'}
        </div>
        <div class="detail-card detail-card--text tab-panel" role="tabpanel" data-proficiency-panel="tools">
          ${tools.length
    ? `<div class="tag-row">${tools.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi strumenti nel profilo.</p>'}
        </div>
        <div class="detail-card detail-card--text tab-panel" role="tabpanel" data-proficiency-panel="languages">
          ${languages.length
    ? `<div class="tag-row">${languages.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi lingue conosciute nel profilo.</p>'}
        </div>
        <div class="detail-card detail-card--text tab-panel" role="tabpanel" data-proficiency-panel="talents">
          ${talents.length
    ? `<div class="tag-row">${talents.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi talenti nel profilo.</p>'}
        </div>
      </div>
      <section class="card home-card home-section home-scroll-panel">
        <header class="card-header">
          <div>
            <p class="eyebrow">Equip</p>
            <span class="pill">Oggetti in sintonia: ${attunedCount}</span>
          </div>
          <div class="actions">
            ${canEditCharacter ? `
              <button class="icon-button icon-button--add" type="button" data-add-equip aria-label="Equipaggia oggetto">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </div>
        </header>
        ${equippedItems.length
    ? `
            <ul class="inventory-list resource-list resource-list--compact">
              ${equippedItems.map((item) => `
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
                      </div>
                    </div>
                  </div>
                  ${canEditCharacter ? `
                    <div class="resource-card-actions">
                      <button class="resource-action-button" type="button" data-unequip="${item.id}">Rimuovi</button>
                    </div>
                  ` : ''}
                </li>
              `).join('')}
            </ul>
          `
    : '<p class="muted">Nessun oggetto equipaggiato.</p>'}
      </section>
    </div>
  `;
}

export function buildEquipmentOverview(character) {
  const data = character.data || {};
  const proficiencies = data.proficiencies || {};
  const equipped = equipmentProficiencyList
    .filter((prof) => proficiencies[prof.key])
    .map((prof) => prof.label);

  return `
    <div class="detail-section">
      <div class="detail-card detail-card--text">
        ${equipped.length
    ? `<div class="tag-row">${equipped.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Nessuna competenza equipaggiamento.</p>'}
      </div>
    </div>
  `;
}

export function buildAttackSection(character, items = []) {
  const data = character.data || {};
  const attackBonusMelee = Number(data.attack_bonus_melee ?? data.attack_bonus) || 0;
  const attackBonusRanged = Number(data.attack_bonus_ranged ?? data.attack_bonus) || 0;
  const damageBonusMelee = Number(data.damage_bonus_melee ?? data.damage_bonus) || 0;
  const damageBonusRanged = Number(data.damage_bonus_ranged ?? data.damage_bonus) || 0;
  const extraAttacks = Number(data.extra_attacks) || 0;
  const equippedWeapons = items.filter((item) => item.category === 'weapon' && item.equipable && getEquipSlots(item).length);
  const spellcasting = data.spellcasting || {};
  const spellAbilityKey = spellcasting.ability;
  const spellAbilityScore = spellAbilityKey ? data.abilities?.[spellAbilityKey] : null;
  const spellAbilityMod = getAbilityModifier(spellAbilityScore);
  const spellProficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const spellAttackBonus = spellAbilityMod === null || spellProficiencyBonus === null
    ? null
    : spellAbilityMod + spellProficiencyBonus;
  const spells = Array.isArray(data.spells) ? data.spells : [];
  const cantripAttacks = spells.filter((spell) => {
    const isCantrip = spell.kind === 'cantrip' || Number(spell.level) === 0;
    return isCantrip && spell.attack_roll && spell.damage_die;
  });
  const hasSpellAttacks = cantripAttacks.length && spellAttackBonus !== null && spellAbilityKey;
  if (!equippedWeapons.length && !hasSpellAttacks) {
    return '<p class="muted">Nessuna arma equipaggiata.</p>';
  }
  const bonusChips = [];
  if (extraAttacks > 0) bonusChips.push(`Attacco Extra (${extraAttacks})`);
  if (attackBonusMelee) bonusChips.push(`Mischia attacco ${formatSigned(attackBonusMelee)}`);
  if (damageBonusMelee) bonusChips.push(`Mischia danni ${formatSigned(damageBonusMelee)}`);
  if (attackBonusRanged) bonusChips.push(`Distanza attacco ${formatSigned(attackBonusRanged)}`);
  if (damageBonusRanged) bonusChips.push(`Distanza danni ${formatSigned(damageBonusRanged)}`);
  const bonusLabel = bonusChips.length
    ? `<div class="tag-row">${bonusChips.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '';
  return `
    ${bonusLabel}
    <div class="detail-section">
      <div class="detail-grid detail-grid--compact">
        ${equippedWeapons.map((weapon) => {
    const weaponRange = weapon.weapon_range || (weapon.range_normal ? 'ranged' : 'melee');
    const attackAbility = weapon.attack_ability
      || (weaponRange === 'ranged' ? 'dex' : 'str');
    const abilityMod = getAbilityModifier(data.abilities?.[attackAbility]) ?? 0;
    const proficiencies = data.proficiencies || {};
    const proficient = weapon.weapon_type === 'simple'
      ? Boolean(proficiencies.weapon_simple)
      : weapon.weapon_type === 'martial'
        ? Boolean(proficiencies.weapon_martial)
        : false;
    const proficiencyBonus = proficient ? (normalizeNumber(data.proficiency_bonus) ?? 0) : 0;
    const attackBonus = weaponRange === 'ranged' ? attackBonusRanged : attackBonusMelee;
    const damageBonus = weaponRange === 'ranged' ? damageBonusRanged : damageBonusMelee;
    const attackTotal = abilityMod + proficiencyBonus + (Number(weapon.attack_modifier) || 0) + attackBonus;
    const damageTotal = abilityMod + (Number(weapon.damage_modifier) || 0) + damageBonus;
    const damageDie = weapon.damage_die ? weapon.damage_die : '-';
    const damageText = damageDie === '-'
      ? '-'
      : `${damageDie}${damageTotal ? ` ${formatSigned(damageTotal)}` : ''}`;
    const normalRange = Number(weapon.range_normal) || null;
    const disadvantageRange = Number(weapon.range_disadvantage) || null;
    const meleeRange = Number(weapon.melee_range) || 1.5;
    const rangeParts = [];
    if (weaponRange === 'melee' && meleeRange > 1.5) {
      rangeParts.push(`Portata ${meleeRange} m`);
    }
    if (weaponRange === 'melee' && weapon.is_thrown && normalRange) {
      rangeParts.push(`Lancio ${normalRange}${disadvantageRange ? `/${disadvantageRange}` : ''}`);
    }
    if (weaponRange !== 'melee' && normalRange) {
      rangeParts.push(`Gittata ${normalRange}${disadvantageRange ? `/${disadvantageRange}` : ''}`);
    }
    const rangeText = rangeParts.join(' · ');
    const abilityLabel = attackAbility === 'dex' ? 'DES' : attackAbility === 'str' ? 'FOR' : attackAbility.toUpperCase();
    const weaponKey = weapon.id ?? weapon.name;
    return `
          <div class="modifier-card attack-card">
            <div class="attack-card__body">
              <div class="attack-card__title">
                <strong class="attack-card__name">${weapon.name}</strong>
                <span class="modifier-ability modifier-ability--${attackAbility}">${abilityLabel}</span>
                <span class="attack-card__hit">${formatSigned(attackTotal)}</span>
              </div>
              <div class="attack-card__meta">
                <span class="attack-card__damage">${damageText}</span>
                ${rangeText ? `<span class="muted">${rangeText}</span>` : ''}
              </div>
            </div>
            <button class="icon-button icon-button--fire" data-roll-damage="${weaponKey}" aria-label="Calcola danni ${weapon.name}">
              <span aria-hidden="true">🔥</span>
            </button>
          </div>
        `;
  }).join('')}
        ${hasSpellAttacks
    ? cantripAttacks.map((spell) => {
      const damageModifier = Number(spell.damage_modifier) || 0;
      const damageText = `${spell.damage_die}${damageModifier ? ` ${formatSigned(damageModifier)}` : ''}`;
      const abilityLabel = abilityShortLabel[spellAbilityKey] ?? spellAbilityKey?.toUpperCase();
      const rangeText = spell.range ? `Range ${spell.range}` : '';
      return `
            <div class="modifier-card attack-card">
              <div class="attack-card__body">
                <div class="attack-card__title">
                  <strong class="attack-card__name">${spell.name}</strong>
                  <span class="modifier-ability modifier-ability--${spellAbilityKey}">${abilityLabel}</span>
                  <span class="attack-card__hit">${formatSigned(spellAttackBonus)}</span>
                </div>
                <div class="attack-card__meta">
                  <span class="attack-card__damage">${damageText}</span>
                  <span class="chip chip--small">Trucchetto</span>
                  ${rangeText ? `<span class="muted">${rangeText}</span>` : ''}
                </div>
              </div>
              <button class="icon-button icon-button--fire" data-roll-damage="spell:${spell.id}" aria-label="Calcola danni ${spell.name}">
                <span aria-hidden="true">🔥</span>
              </button>
            </div>
          `;
    }).join('')
    : ''}
      </div>
    </div>
  `;
}

export function buildSpellSection(character) {
  const data = character.data || {};
  const notes = data.spell_notes || '';
  const spellcasting = data.spellcasting || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const abilityKey = spellcasting.ability;
  const abilityScore = abilityKey ? data.abilities?.[abilityKey] : null;
  const abilityMod = getAbilityModifier(abilityScore);
  const spellSaveDc = abilityMod === null || proficiencyBonus === null
    ? null
    : 8 + abilityMod + proficiencyBonus;
  const spellAttackBonus = abilityMod === null || proficiencyBonus === null
    ? null
    : abilityMod + proficiencyBonus;
  const spellAbilityLabel = abilityKey ? abilityShortLabel[abilityKey] : null;
  const slots = spellcasting.slots || {};
  const slotsMax = spellcasting.slots_max || {};
  const recharge = spellcasting.recharge || 'long_rest';
  const slotLevels = Array.from({ length: 9 }, (_, index) => index + 1);
  const slotEntries = slotLevels.map((level) => {
    const remaining = Math.max(0, Number(slots[level]) || 0);
    const max = Math.max(remaining, Number(slotsMax[level]) || 0);
    return {
      level,
      count: remaining,
      max
    };
  }).filter((entry) => entry.max > 0);
  const summaryChips = [
    `${spellAbilityLabel ?? '-'}`,
    `CD ${spellSaveDc === null ? '-' : spellSaveDc}`,
    `TC ${spellAttackBonus === null ? '-' : formatSigned(spellAttackBonus)}`
  ];
  const summaryChipRow = summaryChips.length
    ? `<div class="tag-row">${summaryChips.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '';
  return `
    ${summaryChipRow}
    <div class="detail-section">
      <div class="detail-card detail-card--text spell-summary-card">
        <div class="spell-slots">
          <span class="spell-slots__title">Slot rimanenti</span>
          <div class="spell-slots__list">
            ${slotEntries.map((entry) => {
    const baseIndicatorClass = recharge === 'short_rest' ? 'charge-indicator' : 'charge-indicator charge-indicator--long';
    const charges = Array.from({ length: entry.max }, (_, index) => {
      const usedClass = index >= entry.count ? 'charge-indicator--used' : '';
      const classes = [baseIndicatorClass, usedClass].filter(Boolean).join(' ');
      return `<span class="${classes}"></span>`;
    }).join('');
    return `
              <div class="spell-slot-row">
                <span class="spell-slot-label">Slot ${entry.level}°</span>
                <span class="spell-slot-count">${entry.count}</span>
                <div class="spell-slot-charges" aria-hidden="true">${charges || '<span class="spell-slot-empty">-</span>'}</div>
              </div>
            `;
  }).join('')}
          </div>
        </div>
        ${notes ? `<p class="spell-notes">${notes}</p>` : ''}
      </div>
      <div class="spell-list-actions">
        <button class="primary spell-list-button" type="button" data-spell-list>Lista Incantesimi</button>
      </div>
    </div>
  `;
}

function getResourceCastTimeRank(castTime) {
  if (!castTime) return RESOURCE_CAST_TIME_ORDER.length;
  const matchIndex = RESOURCE_CAST_TIME_ORDER.findIndex((entry) => entry.label === castTime);
  return matchIndex === -1 ? RESOURCE_CAST_TIME_ORDER.length : matchIndex;
}

function getResourceCastTimeClass(castTime) {
  if (!castTime) return '';
  return RESOURCE_CAST_TIME_ORDER.find((entry) => entry.label === castTime)?.className ?? '';
}

function sortResourcesByCastTime(resources) {
  return [...resources].sort((a, b) => {
    const rankDiff = getResourceCastTimeRank(a.cast_time) - getResourceCastTimeRank(b.cast_time);
    if (rankDiff !== 0) return rankDiff;
    return (a.name ?? '').localeCompare(b.name ?? '', 'it', { sensitivity: 'base' });
  });
}

export function buildResourceList(
  resources,
  canManageResources,
  {
    showCharges = true,
    showUseButton = true,
    showDescription = false,
    showCastTime = true
  } = {}
) {
  return `
    <ul class="resource-list resource-list--compact">
      ${resources.map((res) => `
        <li class="modifier-card attack-card resource-card" data-resource-card="${res.id}">
          ${showCastTime && res.cast_time ? `<span class="resource-chip resource-chip--floating ${getResourceCastTimeClass(res.cast_time)}">${res.cast_time}</span>` : ''}
          <div class="attack-card__body resource-card__body">
            <div class="attack-card__title resource-card__title">
              <strong class="attack-card__name">${res.name}</strong>
            </div>
            ${showDescription
    ? `<p class="resource-card__description">${res.description ?? ''}</p>`
    : ''}
            ${showCharges && Number(res.max_uses)
    ? `
              <div class="resource-card__charges">
                ${buildResourceCharges(res)}
              </div>
            `
    : ''}
          </div>
          <div class="resource-card-actions">
            ${showUseButton ? `
              <button
                class="resource-cta-button resource-cta-button--label"
                data-use-resource="${res.id}"
                ${!Number(res.max_uses) || res.used >= Number(res.max_uses) ? 'disabled' : ''}
              >
                Usa
              </button>
            ` : ''}
            ${canManageResources ? `
              <button class="resource-action-button resource-icon-button" data-edit-resource="${res.id}" aria-label="Modifica risorsa">✏️</button>
              <button class="resource-action-button resource-icon-button" data-delete-resource="${res.id}" aria-label="Elimina risorsa">🗑️</button>
            ` : ''}
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

export function buildResourceSections(resources, canManageResources) {
  if (!resources.length) {
    return '<p>Nessuna risorsa.</p>';
  }
  const sortedResources = sortResourcesByCastTime(resources);
  const passiveResources = sortedResources.filter((resource) => resource.reset_on === null || resource.reset_on === 'none');
  const activeResources = sortedResources.filter((resource) => resource.reset_on !== null && resource.reset_on !== 'none');
  const activeSection = activeResources.length
    ? `
      <div class="resource-section resource-section--active">
        <div class="resource-section__body">
          ${buildResourceList(activeResources, canManageResources, { showUseButton: false })}
        </div>
      </div>
    `
    : '<p class="muted">Nessuna risorsa attiva.</p>';
  const passiveSection = passiveResources.length
    ? `
      <div class="resource-section">
        <header class="card-header"><div><p class="eyebrow">Risorse Passive</p></div></header>
        <div class="resource-section__body">
          ${buildResourceList(passiveResources, canManageResources, {
    showCharges: false,
    showUseButton: false,
    showDescription: true,
    showCastTime: false
  })}
        </div>
      </div>
    `
    : '';
  return `${activeSection}${passiveSection}`;
}

export function buildResourceCharges(resource) {
  const maxUses = Number(resource.max_uses) || 0;
  const used = Number(resource.used) || 0;
  if (!maxUses) return '';
  const style = resource.reset_on === 'long_rest' ? 'long' : 'short';
  const remaining = Math.max(maxUses - used, 0);
  const charges = Array.from({ length: maxUses }, (_, index) => {
    const isUsed = index < used;
    const classes = [
      'charge-indicator',
      style === 'long' ? 'charge-indicator--long' : 'charge-indicator--short',
      isUsed ? 'charge-indicator--used' : ''
    ].filter(Boolean).join(' ');
    return `<span class="${classes}" aria-hidden="true"></span>`;
  }).join('');
  return `
    <div class="resource-charge-row" aria-label="Cariche risorsa">
      <span class="resource-charge-label">Cariche</span>
      <span class="resource-charge-count">${remaining}/${maxUses}</span>
      <div class="resource-charges" aria-hidden="true">${charges}</div>
    </div>
  `;
}
