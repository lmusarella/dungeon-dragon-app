import {
  createCharacter,
  createResource,
  deleteResource,
  fetchCharacters,
  fetchResources,
  updateCharacter,
  updateResource,
  updateResourcesReset
} from './characterApi.js';
import { fetchItems } from '../inventory/inventoryApi.js';
import { getState, setActiveCharacter, setState, updateCache } from '../../app/state.js';
import {
  buildInput,
  buildSelect,
  buildTextarea,
  createToast,
  openConfirmModal,
  openFormModal
} from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { openDiceOverlay } from '../dice-roller/overlay/dice.js';

let fabHandlersBound = false;
let lastHomeContainer = null;

export async function renderHome(container) {
  lastHomeContainer = container;
  container.innerHTML = `<div class="card"><p>Caricamento...</p></div>`;
  const state = getState();
  const { user, offline } = state;

  let characters = state.characters;
  if (!offline && user) {
    try {
      characters = await fetchCharacters(user.id);
      setState({ characters });
      await cacheSnapshot({ characters });
    } catch (error) {
      createToast('Errore caricamento personaggi', 'error');
    }
  }

  const hasActive = characters.some((char) => char.id === state.activeCharacterId);
  if (!hasActive && characters.length) {
    setActiveCharacter(characters[0].id);
  }

  const activeCharacter = characters.find((char) => char.id === getState().activeCharacterId);
  const canCreateCharacter = Boolean(user) && !offline;
  const canManageResources = Boolean(user) && !offline;
  const canEditCharacter = Boolean(user) && !offline;

  let resources = state.cache.resources;
  let items = state.cache.items;
  if (!offline && activeCharacter) {
    try {
      resources = await fetchResources(activeCharacter.id);
      updateCache('resources', resources);
      await cacheSnapshot({ resources });
    } catch (error) {
      createToast('Errore caricamento risorse', 'error');
    }
    try {
      items = await fetchItems(activeCharacter.id);
      updateCache('items', items);
      await cacheSnapshot({ items });
    } catch (error) {
      createToast('Errore caricamento equip', 'error');
    }
  }

  container.innerHTML = `
    <div class="home-layout">
      <div class="home-column home-column--left">
        <section class="card home-card home-section">
          <header class="card-header">
            <div>
              <p class="eyebrow">Tiri salvezza</p>
              <h3></h3>
            </div>
            <div class="actions">
              <button class="icon-button" data-open-dice="saving-throws" aria-label="Lancia dadi tiri salvezza">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          ${activeCharacter ? buildSavingThrowSection(activeCharacter) : '<p>Nessun personaggio selezionato.</p>'}
        </section>
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Abilità</p>            
            </div>
            <div class="actions">
              <button class="icon-button" data-open-dice="skills" aria-label="Lancia dadi abilità">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          <div class="home-scroll-body">
            ${activeCharacter ? buildSkillList(activeCharacter) : '<p>Nessun personaggio selezionato.</p>'}
          </div>
        </section>
      </div>
      <div class="home-column home-column--center">
        <section class="card home-card home-section">
          <header class="card-header">
            <div>
              <p class="eyebrow">Scheda Personaggio</p>           
            </div>
            <div class="actions">
              ${activeCharacter && canEditCharacter ? `
                <button class="icon-button" data-edit-character aria-label="Modifica personaggio">
                  <span aria-hidden="true">✏️</span>
                </button>
              ` : ''}
            </div>
          </header>
          ${activeCharacter ? buildCharacterOverview(activeCharacter, canEditCharacter, items) : buildEmptyState(canCreateCharacter, offline)}
        </section>
      </div>
      <div class="home-column home-column--right">
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Attacchi</p>
            </div>
            <div class="actions">
              <button class="icon-button icon-button--dice" data-open-dice="attack-roll" aria-label="Lancia dadi attacchi">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          <div class="home-scroll-body">
            ${activeCharacter
    ? buildAttackSection(activeCharacter, items || [])
    : '<p>Nessun personaggio selezionato.</p>'}
          </div>
        </section>
        ${activeCharacter?.data?.is_spellcaster ? `
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Incantesimi</p>
            </div>
            ${activeCharacter && canEditCharacter ? `
              <button class="icon-button icon-button--add" data-add-spell aria-label="Aggiungi incantesimo">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </header>
          <div class="home-scroll-body">
            ${buildSpellSection(activeCharacter)}
          </div>
        </section>
        ` : ''}
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Risorse</p>           
            </div>
            ${activeCharacter && canManageResources ? `
              <button class="icon-button icon-button--add" data-add-resource aria-label="Nuova risorsa">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </header>
          <div class="home-scroll-body home-scroll-body--resources">
            ${activeCharacter
    ? buildResourceSections(resources, canManageResources)
    : '<p>Nessun personaggio selezionato.</p>'}
            ${activeCharacter && !canManageResources ? '<p class="muted">Connettiti per aggiungere nuove risorse.</p>' : ''}
          </div>
        </section>
      </div>
    </div>
  `;

  bindFabHandlers();

  const createButton = container.querySelector('[data-create-character]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderHome(container));
    });
  }

  const editButton = container.querySelector('[data-edit-character]');
  if (editButton) {
    editButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderHome(container), activeCharacter);
    });
  }

  const addResourceButton = container.querySelector('[data-add-resource]');
  if (addResourceButton) {
    addResourceButton.addEventListener('click', () => {
      openResourceDrawer(activeCharacter, () => renderHome(container));
    });
  }

  const addSpellButton = container.querySelector('[data-add-spell]');
  if (addSpellButton) {
    addSpellButton.addEventListener('click', () => {
      openSpellDrawer(activeCharacter, () => renderHome(container));
    });
  }

  const spellListButton = container.querySelector('[data-spell-list]');
  if (spellListButton) {
    spellListButton.addEventListener('click', () => {
      openSpellListModal(activeCharacter, container);
    });
  }

  const backgroundButton = container.querySelector('[data-show-background]');
  if (backgroundButton) {
    backgroundButton.addEventListener('click', () => {
      openBackgroundModal(activeCharacter);
    });
  }

  const inspirationButton = container.querySelector('[data-toggle-inspiration]');
  if (inspirationButton && activeCharacter && canEditCharacter) {
    inspirationButton.addEventListener('click', async () => {
      const currentData = activeCharacter.data || {};
      const nextData = {
        ...currentData,
        inspiration: !currentData.inspiration
      };
      await saveCharacterData(activeCharacter, nextData, 'Ispirazione aggiornata', container);
    });
  }

  container.querySelectorAll('[data-open-dice]')
    .forEach((button) => button.addEventListener('click', () => {
      handleDiceAction(button.dataset.openDice);
    }));

  container.querySelectorAll('[data-edit-resource]')
    .forEach((button) => button.addEventListener('click', () => {
      const resource = resources.find((entry) => entry.id === button.dataset.editResource);
      if (!resource) return;
      openResourceDrawer(activeCharacter, () => renderHome(container), resource);
    }));

  container.querySelectorAll('[data-roll-damage]')
    .forEach((button) => button.addEventListener('click', () => {
      if (!activeCharacter) return;
      const rollKey = button.dataset.rollDamage;
      if (!rollKey) return;
      if (rollKey.startsWith('spell:')) {
        const spellId = rollKey.replace('spell:', '');
        const spells = Array.isArray(activeCharacter.data?.spells) ? activeCharacter.data.spells : [];
        const spell = spells.find((entry) => entry.id === spellId);
        if (!spell) return;
        const overlayConfig = buildSpellDamageOverlayConfig(spell);
        if (!overlayConfig) {
          createToast('Danno non calcolabile per questo trucchetto.', 'error');
          return;
        }
        openDiceOverlay({
          title: overlayConfig.title,
          mode: 'generic',
          notation: overlayConfig.notation,
          modifier: overlayConfig.modifier,
          rollType: 'DMG'
        });
        return;
      }
      const weapon = items?.find((entry) => String(entry.id) === rollKey || entry.name === rollKey);
      if (!weapon) return;
      const overlayConfig = buildWeaponDamageOverlayConfig(activeCharacter, weapon);
      if (!overlayConfig) {
        createToast('Danno non calcolabile per questa arma.', 'error');
        return;
      }
      openDiceOverlay({
        title: overlayConfig.title,
        mode: 'generic',
        notation: overlayConfig.notation,
        modifier: overlayConfig.modifier,
        rollType: 'DMG'
      });
    }));

  const longPressDelay = 500;
  container.querySelectorAll('[data-resource-card]')
    .forEach((card) => {
      let pressTimer = null;
      const startPress = (event) => {
        if (event.target.closest('button')) return;
        pressTimer = setTimeout(async () => {
          const resource = resources.find((entry) => entry.id === card.dataset.resourceCard);
          if (!resource) return;
          openResourceDetail(resource);
        }, longPressDelay);
      };
      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      const handleSelect = (event) => {
        if (event.target.closest('button')) return;
        container.querySelectorAll('.resource-card.is-selected')
          .forEach((selectedCard) => selectedCard.classList.remove('is-selected'));
        card.classList.add('is-selected');
        window.setTimeout(() => {
          card.classList.remove('is-selected');
        }, 800);
      };
      card.addEventListener('pointerdown', startPress);
      card.addEventListener('pointerup', cancelPress);
      card.addEventListener('pointerleave', cancelPress);
      card.addEventListener('pointercancel', cancelPress);
      card.addEventListener('pointermove', cancelPress);
      card.addEventListener('click', handleSelect);
    });

  container.querySelectorAll('[data-use-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.useResource);
      if (!resource) return;
      const maxUses = Number(resource.max_uses) || 0;
      if (!maxUses || resource.used >= maxUses) return;
      try {
        await updateResource(resource.id, { used: Math.min(resource.used + 1, maxUses) });
        createToast('Risorsa usata');
        renderHome(container);
      } catch (error) {
        createToast('Errore utilizzo risorsa', 'error');
      }
    }));

  container.querySelectorAll('[data-death-save]')
    .forEach((button) => button.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const { deathSave: group, deathSaveIndex } = button.dataset;
      const index = Number(deathSaveIndex);
      if (!group || !index) return;
      const data = activeCharacter.data || {};
      const deathSaves = data.death_saves || {};
      const current = Math.max(0, Math.min(3, Number(deathSaves[group]) || 0));
      const nextValue = index === current ? current - 1 : index;
      const nextDeathSaves = {
        successes: Math.max(0, Math.min(3, group === 'successes' ? nextValue : Number(deathSaves.successes) || 0)),
        failures: Math.max(0, Math.min(3, group === 'failures' ? nextValue : Number(deathSaves.failures) || 0))
      };
      await saveCharacterData(activeCharacter, {
        ...data,
        death_saves: nextDeathSaves
      }, 'Tiri salvezza contro morte aggiornati', container);
    }));

  container.querySelectorAll('[data-weakness-level]')
    .forEach((button) => button.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const level = Number(button.dataset.weaknessLevel);
      if (!level) return;
      const data = activeCharacter.data || {};
      const hp = data.hp || {};
      const current = Math.max(0, Math.min(6, Number(hp.weak_points) || 0));
      const nextValue = level === current ? 0 : level;
      await saveCharacterData(activeCharacter, {
        ...data,
        hp: {
          ...hp,
          weak_points: nextValue
        }
      }, 'Punti indebolimento aggiornati', container);
    }));

  const avatar = container.querySelector('.character-avatar');
  if (avatar) {
    avatar.addEventListener('pointerdown', (event) => {
      if (event.button && event.button !== 0) return;
      event.preventDefault();
      const src = avatar.getAttribute('src');
      if (!src) return;
      const closePreview = openAvatarPreview(src, avatar.getAttribute('alt') || 'Ritratto personaggio');
      const closeOnRelease = () => {
        closePreview();
        window.removeEventListener('pointerup', closeOnRelease);
        window.removeEventListener('pointercancel', closeOnRelease);
        window.removeEventListener('blur', closeOnRelease);
      };
      window.addEventListener('pointerup', closeOnRelease);
      window.addEventListener('pointercancel', closeOnRelease);
      window.addEventListener('blur', closeOnRelease);
    });
  }

}

function bindFabHandlers() {
  if (fabHandlersBound) return;
  document.addEventListener('click', async (event) => {
    const fabContainer = event.target.closest('[data-actions-fab]');
    if (!fabContainer) return;
    const hpButton = event.target.closest('[data-hp-action]');
    const restButton = event.target.closest('[data-rest]');
    const diceButton = event.target.closest('[data-open-dice]');
    if (!hpButton && !restButton && !diceButton) return;
    event.preventDefault();
    const container = lastHomeContainer ?? document.querySelector('[data-route-outlet]');
    if (hpButton) {
      await handleHpAction(hpButton.dataset.hpAction, container);
      closeFabMenu();
      return;
    }
    if (restButton) {
      await handleRestAction(restButton.dataset.rest, container);
      closeFabMenu();
      return;
    }
    if (diceButton) {
      handleDiceAction(diceButton.dataset.openDice);
      closeFabMenu();
    }
  });
  fabHandlersBound = true;
}

function closeFabMenu() {
  const actionsFab = document.querySelector('[data-actions-fab]');
  const actionsToggle = document.querySelector('[data-actions-toggle]');
  if (!actionsFab || !actionsFab.classList.contains('is-open')) return;
  actionsFab.classList.remove('is-open');
  actionsToggle?.setAttribute('aria-expanded', 'false');
}

function getHomeContext() {
  const state = getState();
  const { user, offline, characters, activeCharacterId } = state;
  const activeCharacter = characters.find((char) => char.id === activeCharacterId);
  return {
    activeCharacter,
    canEditCharacter: Boolean(user) && !offline
  };
}

function buildSkillRollOptions(character) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};
  return skillList.map((skill) => {
    const proficient = Boolean(skillStates[skill.key]);
    const mastery = Boolean(skillMasteryStates[skill.key]);
    const total = calculateSkillModifier(abilities[skill.ability], proficiencyBonus, proficient ? (mastery ? 2 : 1) : 0);
    const modifierValue = total ?? 0;
    return {
      value: skill.key,
      label: `${skill.label} (${formatSigned(total)})`,
      shortLabel: skill.label,
      modifier: modifierValue
    };
  });
}

function buildSavingThrowRollOptions(character) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const savingStates = data.saving_throws || {};
  return savingThrowList.map((save) => {
    const proficient = Boolean(savingStates[save.key]);
    const total = calculateSkillModifier(abilities[save.key], proficiencyBonus, proficient ? 1 : 0);
    const modifierValue = total ?? 0;
    return {
      value: save.key,
      label: `${save.label} (${formatSigned(total)})`,
      shortLabel: abilityShortLabel[save.key] || save.label,
      modifier: modifierValue
    };
  });
}

function buildAttackRollOptions(character, items = []) {
  const data = character.data || {};
  const attackBonusMelee = Number(data.attack_bonus_melee ?? data.attack_bonus) || 0;
  const attackBonusRanged = Number(data.attack_bonus_ranged ?? data.attack_bonus) || 0;
  const equippedWeapons = (items || []).filter((item) => item.category === 'weapon' && item.equipable && getEquipSlots(item).length);
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus) ?? 0;
  const proficiencies = data.proficiencies || {};
  const options = equippedWeapons.map((weapon) => {
    const weaponRange = weapon.weapon_range || (weapon.range_normal ? 'ranged' : 'melee');
    const attackAbility = weapon.attack_ability || (weaponRange === 'ranged' ? 'dex' : 'str');
    const abilityMod = getAbilityModifier(data.abilities?.[attackAbility]) ?? 0;
    const proficient = weapon.weapon_type === 'simple'
      ? Boolean(proficiencies.weapon_simple)
      : weapon.weapon_type === 'martial'
        ? Boolean(proficiencies.weapon_martial)
        : false;
    const weaponProficiencyBonus = proficient ? proficiencyBonus : 0;
    const attackBonus = weaponRange === 'ranged' ? attackBonusRanged : attackBonusMelee;
    const attackTotal = abilityMod + weaponProficiencyBonus + (Number(weapon.attack_modifier) || 0) + attackBonus;
    return {
      value: `weapon:${weapon.id ?? weapon.name}`,
      label: `${weapon.name} (${formatSigned(attackTotal)})`,
      shortLabel: weapon.name,
      modifier: attackTotal
    };
  });

  const spellcasting = data.spellcasting || {};
  const spellAbilityKey = spellcasting.ability;
  const spellAbilityScore = spellAbilityKey ? data.abilities?.[spellAbilityKey] : null;
  const spellAbilityMod = getAbilityModifier(spellAbilityScore);
  const spellAttackBonus = spellAbilityMod === null || proficiencyBonus === null
    ? null
    : spellAbilityMod + proficiencyBonus;
  const spells = Array.isArray(data.spells) ? data.spells : [];
  const cantripAttacks = spells.filter((spell) => {
    const isCantrip = spell.kind === 'cantrip' || Number(spell.level) === 0;
    return isCantrip && spell.attack_roll && spell.damage_die;
  });
  if (spellAbilityKey && spellAttackBonus !== null) {
    cantripAttacks.forEach((spell) => {
      options.push({
        value: `spell:${spell.id}`,
        label: `${spell.name} (${formatSigned(spellAttackBonus)})`,
        shortLabel: spell.name,
        modifier: spellAttackBonus
      });
    });
  }

  return options;
}

function handleDiceAction(type) {
  const { activeCharacter, canEditCharacter } = getHomeContext();
  const items = getState().cache.items || [];
  const allowInspiration = Boolean(activeCharacter?.data?.inspiration) && canEditCharacter;
  const onConsumeInspiration = allowInspiration && activeCharacter
    ? async () => {
      const currentData = activeCharacter.data || {};
      if (!currentData.inspiration) return;
      await saveCharacterData(activeCharacter, { ...currentData, inspiration: false }, 'Ispirazione consumata', lastHomeContainer);
    }
    : null;
  const configs = {
    'saving-throws': {
      title: 'Tiro Salvezza',
      mode: 'd20',
      rollType: 'TS',
      selection: activeCharacter
        ? { label: 'Tiro salvezza', options: buildSavingThrowRollOptions(activeCharacter) }
        : null
    },
    skills: {
      title: 'Tiro Abilità',
      mode: 'd20',
      rollType: 'TA',
      selection: activeCharacter
        ? { label: 'Abilità', options: buildSkillRollOptions(activeCharacter) }
        : null
    },
    'attack-roll': {
      title: 'Tiro per Colpire',
      mode: 'd20',
      rollType: 'TC',
      selection: activeCharacter
        ? { label: 'Attacco', options: buildAttackRollOptions(activeCharacter, items) }
        : null
    },
    roller: { title: 'Lancia Dadi generico', mode: 'generic', rollType: 'GEN' }
  };
  const config = configs[type] ?? { title: 'Lancia dadi', mode: 'generic' };
  openDiceRollerModal({
    ...config,
    allowInspiration,
    onConsumeInspiration
  });
}

async function handleRestAction(resetOn, container) {
  const { activeCharacter } = getHomeContext();
  if (!activeCharacter) return;
  const shouldRest = await openConfirmModal({ message: 'Confermi il riposo?' });
  if (!shouldRest) return;
  try {
    await updateResourcesReset(activeCharacter.id, resetOn);
    const toastLabel = resetOn === 'long_rest' ? 'Riposo lungo completato' : 'Riposo breve completato';
    createToast(toastLabel);
    const refreshed = await fetchResources(activeCharacter.id);
    updateCache('resources', refreshed);
    await cacheSnapshot({ resources: refreshed });
    const nextData = applyRestRecovery(activeCharacter.data, resetOn);
    if (nextData) {
      await saveCharacterData(activeCharacter, nextData, null, container);
      return;
    }
    if (container) {
      renderHome(container);
    }
  } catch (error) {
    createToast('Errore aggiornamento risorse', 'error');
  }
}

async function handleHpAction(action, container) {
  const { activeCharacter, canEditCharacter } = getHomeContext();
  if (!activeCharacter || !canEditCharacter) return;
  const title = action === 'heal' ? 'Cura PF' : 'Infliggi danno';
  const submitLabel = action === 'heal' ? 'Cura' : 'Danno';
  const formData = await openFormModal({
    title,
    submitLabel,
    content: buildHpShortcutFields(activeCharacter, {
      allowHitDice: action === 'heal',
      allowTempHp: action === 'heal',
      allowMaxOverride: action === 'damage'
    })
  });
  if (!formData) return;
  const useHitDice = formData.has('use_hit_dice');
  const useTempHp = formData.has('temp_hp');
  const hitDice = activeCharacter.data?.hit_dice || {};
  const abilities = activeCharacter.data?.abilities || {};
  const hitDiceUsed = Number(hitDice.used) || 0;
  const hitDiceMax = Number(hitDice.max) || 0;
  const hitDiceSides = getHitDiceSides(hitDice.die);
  const diceCount = Math.max(Number(formData.get('hit_dice_count')) || 1, 1);
  let amount = Number(formData.get('amount'));

  if (action === 'heal' && useHitDice) {
    if (!hitDiceSides) {
      createToast('Configura un dado vita valido', 'error');
      return;
    }
    if (hitDiceUsed >= hitDiceMax) {
      createToast('Nessun dado vita disponibile', 'error');
      return;
    }
    const remaining = Math.max(hitDiceMax - hitDiceUsed, 0);
    if (diceCount > remaining) {
      createToast(`Hai solo ${remaining} dadi vita disponibili`, 'error');
      return;
    }
    const conMod = getAbilityModifier(abilities.con) ?? 0;
    const rolls = Array.from({ length: diceCount }, () => rollDie(hitDiceSides));
    const totalRoll = rolls.reduce((sum, roll) => sum + roll, 0);
    amount = Math.max(totalRoll + conMod * diceCount, 1);
  }

  if (!amount || amount <= 0) {
    createToast('Inserisci un valore valido', 'error');
    return;
  }
  const currentHp = Number(activeCharacter.data?.hp?.current) || 0;
  const currentTempHp = Number(activeCharacter.data?.hp?.temp) || 0;
  const maxHp = activeCharacter.data?.hp?.max;
  const maxOverrideRaw = formData.get('hp_max_override');
  const maxOverrideValue = maxOverrideRaw === null || maxOverrideRaw === '' ? null : Number(maxOverrideRaw);
  if (action === 'damage' && maxOverrideValue !== null && (!Number.isFinite(maxOverrideValue) || maxOverrideValue <= 0)) {
    createToast('Inserisci un massimo PF valido', 'error');
    return;
  }
  let nextCurrent = currentHp;
  let nextTemp = currentTempHp;
  if (action === 'heal' && useTempHp) {
    nextTemp = currentTempHp + amount;
  } else if (action === 'heal') {
    nextCurrent = currentHp + amount;
  } else {
    const absorbed = Math.min(currentTempHp, amount);
    nextTemp = currentTempHp - absorbed;
    const remainingDamage = amount - absorbed;
    nextCurrent = Math.max(currentHp - remainingDamage, 0);
  }
  const effectiveMax = maxOverrideValue !== null && maxOverrideValue !== undefined
    ? maxOverrideValue
    : maxHp;
  const adjusted = effectiveMax !== null && effectiveMax !== undefined
    ? Math.min(nextCurrent, Number(effectiveMax))
    : nextCurrent;
  const nextHitDice = action === 'heal' && useHitDice
    ? {
      ...hitDice,
      used: Math.min(hitDiceUsed + diceCount, hitDiceMax)
    }
    : hitDice;
  const message = action === 'heal'
    ? `${useTempHp ? 'HP temporanei +' : 'PF curati +'}${amount}${useHitDice ? ` (${diceCount}d${hitDiceSides})` : ''}`
    : `Danno ${amount}`;
  await saveCharacterData(activeCharacter, {
    ...activeCharacter.data,
    hp: {
      ...activeCharacter.data?.hp,
      current: adjusted,
      temp: nextTemp,
      max: maxOverrideValue !== null && maxOverrideValue !== undefined ? maxOverrideValue : maxHp
    },
    hit_dice: nextHitDice
  }, message, container);
}

function openResourceDetail(resource) {
  const detail = document.createElement('div');
  detail.className = 'resource-detail';
  const maxUses = Number(resource.max_uses) || 0;
  const usageLabel = maxUses ? `${resource.used}/${resource.max_uses}` : 'Passiva';
  detail.innerHTML = `
    <div class="detail-card detail-card--text">
      ${resource.image_url ? `<img class="resource-detail-image" src="${resource.image_url}" alt="Foto di ${resource.name}" />` : ''}
      <h4>${resource.name}</h4>
      ${resource.cast_time ? `<p class="resource-chip">${resource.cast_time}</p>` : ''}
      <p class="muted">${formatResourceRecovery(resource)}</p>
      <p>Cariche: ${usageLabel}</p>
      ${resource.description ? `<p>${resource.description}</p>` : ''}
    </div>
  `;
  openFormModal({
    title: 'Dettaglio risorsa',
    submitLabel: 'Chiudi',
    content: detail
  });
}

function openDiceRollerModal({
  title,
  mode,
  selection = null,
  allowInspiration = false,
  onConsumeInspiration = null,
  rollType = null
}) {
  openDiceOverlay({
    keepOpen: true,
    title,
    mode,
    selection,
    allowInspiration,
    onConsumeInspiration,
    rollType
  });
}

async function saveCharacterData(character, data, message, container) {
  if (!character) return;
  const payload = {
    name: character.name,
    system: character.system ?? null,
    data
  };
  try {
    const updated = await updateCharacter(character.id, payload);
    const nextCharacters = getState().characters.map((char) => (char.id === updated.id ? updated : char));
    setState({ characters: nextCharacters });
    await cacheSnapshot({ characters: nextCharacters });
    if (message) {
      createToast(message);
    }
    if (container) {
      renderHome(container);
    }
  } catch (error) {
    createToast('Errore aggiornamento personaggio', 'error');
  }
}

function openAvatarPreview(src, alt) {
  const existing = document.querySelector('.avatar-preview');
  if (existing) {
    existing.remove();
  }
  const overlay = document.createElement('div');
  overlay.className = 'avatar-preview';
  const image = document.createElement('img');
  image.className = 'avatar-preview__image';
  image.src = src;
  image.alt = alt;
  overlay.appendChild(image);
  document.body.appendChild(overlay);
  return () => {
    overlay.remove();
  };
}

function buildEmptyState(canCreateCharacter, offline) {
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

export async function openCharacterDrawer(user, onSave, character = null) {
  if (!user) return;
  const characterData = character?.data || {};
  const hp = characterData.hp || {};
  const hitDice = characterData.hit_dice || {};
  const abilities = characterData.abilities || {};
  const skillStates = characterData.skills || {};
  const skillMasteryStates = characterData.skill_mastery || {};
  const savingStates = characterData.saving_throws || {};
  const proficiencies = characterData.proficiencies || {};
  const acAbilityModifiers = characterData.ac_ability_modifiers || {};
  const spellcasting = characterData.spellcasting || {};
  const spellSlots = spellcasting.slots || {};
  const currentSpells = Array.isArray(characterData.spells) ? sortSpellsByLevel(characterData.spells) : [];
  const form = document.createElement('div');
  form.className = 'character-edit-form';
  const buildEditGroup = (title, sections) => {
    const group = document.createElement('section');
    group.className = 'character-edit-group';
    group.innerHTML = `<h3>${title}</h3>`;
    const content = document.createElement('div');
    content.className = 'character-edit-group__content';
    sections.forEach((section) => {
      section.classList.add('character-edit-subsection');
      content.appendChild(section);
    });
    group.appendChild(content);
    return group;
  };

  const mainSection = document.createElement('div');
  mainSection.className = 'character-edit-section';
  mainSection.innerHTML = '<h4>Dati principali</h4>';
  const nameField = buildInput({ label: 'Nome', name: 'name', placeholder: 'Es. Aria', value: character?.name ?? '' });
  nameField.querySelector('input').required = true;
  mainSection.appendChild(nameField);
  mainSection.appendChild(buildInput({ label: 'Sistema', name: 'system', placeholder: 'Es. D&D 5e', value: character?.system ?? '' }));
  const mainGrid = document.createElement('div');
  mainGrid.className = 'character-edit-grid';
  mainGrid.appendChild(buildInput({ label: 'Livello', name: 'level', type: 'number', value: characterData.level ?? '' }));
  mainGrid.appendChild(buildInput({ label: 'Razza', name: 'race', value: characterData.race ?? '' }));
  mainGrid.appendChild(buildInput({ label: 'Allineamento', name: 'alignment', value: characterData.alignment ?? '' }));
  mainGrid.appendChild(buildInput({ label: 'Background', name: 'background', value: characterData.background ?? '' }));
  mainGrid.appendChild(buildInput({ label: 'Classe', name: 'class_name', value: characterData.class_name ?? characterData.class_archetype ?? '' }));
  mainGrid.appendChild(buildInput({ label: 'Archetipo', name: 'archetype', value: characterData.archetype ?? '' }));
  mainSection.appendChild(mainGrid);
  mainSection.appendChild(buildInput({
    label: 'Foto (URL)',
    name: 'avatar_url',
    placeholder: 'https://.../ritratto.png',
    value: characterData.avatar_url ?? ''
  }));
  mainSection.appendChild(buildTextarea({
    label: 'Descrizione background',
    name: 'description',
    placeholder: 'Dettagli sul background, origini e tratti distintivi...',
    value: characterData.description ?? ''
  }));

  const statsSection = document.createElement('div');
  statsSection.className = 'character-edit-section';
  statsSection.innerHTML = '<h4>Statistiche base</h4>';
  const statsGrid = document.createElement('div');
  statsGrid.className = 'character-edit-grid';
  statsGrid.appendChild(buildInput({ label: 'Bonus competenza', name: 'proficiency_bonus', type: 'number', value: characterData.proficiency_bonus ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Iniziativa', name: 'initiative', type: 'number', value: characterData.initiative ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Classe Armatura', name: 'ac', type: 'number', value: characterData.ac ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Velocità', name: 'speed', type: 'number', value: characterData.speed ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'HP attuali', name: 'hp_current', type: 'number', value: hp.current ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'HP temporanei', name: 'hp_temp', type: 'number', value: hp.temp ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'HP massimi', name: 'hp_max', type: 'number', value: hp.max ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Dado vita (es. d8)', name: 'hit_dice_die', value: hitDice.die ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Dadi vita totali', name: 'hit_dice_max', type: 'number', value: hitDice.max ?? '' }));
  statsGrid.appendChild(buildInput({ label: 'Dadi vita usati', name: 'hit_dice_used', type: 'number', value: hitDice.used ?? '' }));
  statsSection.appendChild(statsGrid);

  const acSection = document.createElement('div');
  acSection.className = 'character-edit-section';
  acSection.innerHTML = `
    <h4>Opzioni CA base</h4>
    <p class="muted">Base = 10 + Destrezza. Seleziona eventuali modificatori extra.</p>
    <div class="character-saving-grid">
      ${[
    { key: 'str', label: 'Forza' },
    { key: 'con', label: 'Costituzione' },
    { key: 'int', label: 'Intelligenza' },
    { key: 'wis', label: 'Saggezza' },
    { key: 'cha', label: 'Carisma' }
  ].map((ability) => `
        <label class="toggle-pill">
          <input type="checkbox" name="ac_mod_${ability.key}" ${acAbilityModifiers[ability.key] ? 'checked' : ''} />
          <span>${ability.label}</span>
        </label>
      `).join('')}
    </div>
  `;
  acSection.appendChild(buildInput({
    label: 'Modificatore CA totale',
    name: 'ac_bonus',
    type: 'number',
    value: characterData.ac_bonus ?? 0
  }));

  const abilitySection = document.createElement('div');
  abilitySection.className = 'character-edit-section';
  abilitySection.innerHTML = '<h4>Caratteristiche</h4>';
  const abilityGrid = document.createElement('div');
  abilityGrid.className = 'character-edit-grid';
  abilityGrid.appendChild(buildInput({ label: 'Forza', name: 'ability_str', type: 'number', value: abilities.str ?? '' }));
  abilityGrid.appendChild(buildInput({ label: 'Destrezza', name: 'ability_dex', type: 'number', value: abilities.dex ?? '' }));
  abilityGrid.appendChild(buildInput({ label: 'Costituzione', name: 'ability_con', type: 'number', value: abilities.con ?? '' }));
  abilityGrid.appendChild(buildInput({ label: 'Intelligenza', name: 'ability_int', type: 'number', value: abilities.int ?? '' }));
  abilityGrid.appendChild(buildInput({ label: 'Saggezza', name: 'ability_wis', type: 'number', value: abilities.wis ?? '' }));
  abilityGrid.appendChild(buildInput({ label: 'Carisma', name: 'ability_cha', type: 'number', value: abilities.cha ?? '' }));
  abilitySection.appendChild(abilityGrid);

  const skillSection = document.createElement('div');
  skillSection.className = 'character-edit-section';
  skillSection.innerHTML = `
    <h4>Competenze e maestria</h4>
    <div class="character-skill-grid">
      ${skillList.map((skill) => {
    const proficient = Boolean(skillStates[skill.key]);
    const mastery = Boolean(skillMasteryStates[skill.key]);
    return `
        <div class="character-skill-row">
          <div>
            <strong>${skill.label}</strong>
            <span class="muted">${abilityShortLabel[skill.ability]}</span>
          </div>
          <div class="character-toggle-group">
            <label class="toggle-pill">
              <input type="checkbox" name="skill_${skill.key}" ${proficient ? 'checked' : ''} />
              <span>Competenza</span>
            </label>
            <label class="toggle-pill">
              <input type="checkbox" name="mastery_${skill.key}" ${mastery ? 'checked' : ''} />
              <span>Maestria</span>
            </label>
          </div>
        </div>
      `;
  }).join('')}
    </div>
  `;

  const savingSection = document.createElement('div');
  savingSection.className = 'character-edit-section';
  savingSection.innerHTML = `
    <h4>Tiri salvezza</h4>
    <div class="character-saving-grid">
      ${savingThrowList.map((save) => {
    const proficient = Boolean(savingStates[save.key]);
    return `
        <label class="toggle-pill">
          <input type="checkbox" name="save_${save.key}" ${proficient ? 'checked' : ''} />
          <span>${save.label}</span>
        </label>
      `;
  }).join('')}
    </div>
  `;

  const proficiencySection = document.createElement('div');
  proficiencySection.className = 'character-edit-section';
  proficiencySection.innerHTML = `
    <h4>Competenze equipaggiamento</h4>
    <div class="character-saving-grid">
      ${equipmentProficiencyList.map((prof) => {
    const proficient = Boolean(proficiencies[prof.key]);
    return `
        <label class="toggle-pill">
          <input type="checkbox" name="prof_${prof.key}" ${proficient ? 'checked' : ''} />
          <span>${prof.label}</span>
        </label>
      `;
  }).join('')}
    </div>
  `;

  const combatSection = document.createElement('div');
  combatSection.className = 'character-edit-section';
  combatSection.innerHTML = '<h4>Combattimento e magia</h4>';
  const combatGrid = document.createElement('div');
  combatGrid.className = 'character-edit-grid';
  combatGrid.appendChild(buildInput({
    label: 'Bonus attacco extra (mischia)',
    name: 'attack_bonus_melee',
    type: 'number',
    value: characterData.attack_bonus_melee ?? characterData.attack_bonus ?? 0
  }));
  combatGrid.appendChild(buildInput({
    label: 'Bonus attacco extra (distanza)',
    name: 'attack_bonus_ranged',
    type: 'number',
    value: characterData.attack_bonus_ranged ?? characterData.attack_bonus ?? 0
  }));
  combatGrid.appendChild(buildInput({
    label: 'Attacchi extra',
    name: 'extra_attacks',
    type: 'number',
    value: characterData.extra_attacks ?? 0
  }));
  combatGrid.appendChild(buildInput({
    label: 'Bonus danni extra (mischia)',
    name: 'damage_bonus_melee',
    type: 'number',
    value: characterData.damage_bonus_melee ?? characterData.damage_bonus ?? 0
  }));
  combatGrid.appendChild(buildInput({
    label: 'Bonus danni extra (distanza)',
    name: 'damage_bonus_ranged',
    type: 'number',
    value: characterData.damage_bonus_ranged ?? characterData.damage_bonus ?? 0
  }));
  combatSection.appendChild(combatGrid);
  const spellcasterField = document.createElement('label');
  spellcasterField.className = 'checkbox';
  spellcasterField.innerHTML = '<input type="checkbox" name="is_spellcaster" /> <span>Incantatore</span>';
  const spellcasterInput = spellcasterField.querySelector('input');
  if (spellcasterInput) {
    spellcasterInput.checked = Boolean(characterData.is_spellcaster);
  }
  combatSection.appendChild(spellcasterField);
  const spellcastingSection = document.createElement('div');
  spellcastingSection.className = 'character-edit-section spellcasting-section';
  spellcastingSection.innerHTML = '<h4>Incantesimi</h4>';
  const spellcastingGrid = document.createElement('div');
  spellcastingGrid.className = 'character-edit-grid';
  const spellcastingAbilityField = document.createElement('label');
  spellcastingAbilityField.className = 'field';
  spellcastingAbilityField.innerHTML = '<span>Caratteristica da incantatore</span>';
  const spellcastingAbilitySelect = buildSelect([
    { value: '', label: 'Seleziona...' },
    { value: 'int', label: 'Intelligenza' },
    { value: 'wis', label: 'Saggezza' },
    { value: 'cha', label: 'Carisma' },
    { value: 'str', label: 'Forza' },
    { value: 'dex', label: 'Destrezza' },
    { value: 'con', label: 'Costituzione' }
  ], spellcasting.ability ?? '');
  spellcastingAbilitySelect.name = 'spellcasting_ability';
  spellcastingAbilityField.appendChild(spellcastingAbilitySelect);
  spellcastingGrid.appendChild(spellcastingAbilityField);
  const spellSaveField = buildInput({
    label: 'CD incantesimi',
    name: 'spell_save_dc',
    type: 'number',
    value: ''
  });
  const spellSaveInput = spellSaveField.querySelector('input');
  if (spellSaveInput) {
    spellSaveInput.readOnly = true;
    spellSaveInput.disabled = true;
  }
  spellcastingGrid.appendChild(spellSaveField);
  const spellAttackField = buildInput({
    label: 'Tiro per colpire incantesimi',
    name: 'spell_attack_bonus',
    type: 'number',
    value: ''
  });
  const spellAttackInput = spellAttackField.querySelector('input');
  if (spellAttackInput) {
    spellAttackInput.readOnly = true;
    spellAttackInput.disabled = true;
  }
  spellcastingGrid.appendChild(spellAttackField);
  spellcastingSection.appendChild(spellcastingGrid);
  const slotGrid = document.createElement('div');
  slotGrid.className = 'character-edit-grid';
  Array.from({ length: 9 }, (_, index) => index + 1).forEach((level) => {
    slotGrid.appendChild(buildInput({
      label: `Slot ${level}°`,
      name: `spell_slot_${level}`,
      type: 'number',
      value: spellSlots[level] ?? 0
    }));
  });
  spellcastingSection.appendChild(slotGrid);
  const slotRechargeField = document.createElement('label');
  slotRechargeField.className = 'field';
  slotRechargeField.innerHTML = '<span>Ricarica slot</span>';
  const slotRechargeSelect = buildSelect([
    { value: 'short_rest', label: 'Riposo breve' },
    { value: 'long_rest', label: 'Riposo lungo' }
  ], spellcasting.recharge ?? 'long_rest');
  slotRechargeSelect.name = 'spell_slot_recharge';
  slotRechargeField.appendChild(slotRechargeSelect);
  spellcastingSection.appendChild(slotRechargeField);
  spellcastingSection.appendChild(buildTextarea({
    label: 'Incantesimi (note)',
    name: 'spell_notes',
    placeholder: 'Descrivi gli incantesimi noti/preparati e gli slot principali.',
    value: characterData.spell_notes ?? ''
  }));
  const spellListSection = document.createElement('div');
  spellListSection.className = 'character-edit-section';
  spellListSection.innerHTML = `
    <h4>Gestione incantesimi</h4>
    ${currentSpells.length
    ? `
      <p class="muted">Seleziona gli incantesimi da rimuovere.</p>
      <div class="character-edit-spell-list">
        ${currentSpells.map((spell) => `
          <label class="character-edit-spell-row">
            <input type="checkbox" name="remove_spell_${spell.id}" />
            <span>
              <strong>${spell.name}</strong>
              <small>${getSpellTypeLabel(spell)} • Livello ${Number(spell.level) || 0}</small>
            </span>
          </label>
        `).join('')}
      </div>
    `
    : '<p class="muted">Nessun incantesimo configurato.</p>'}
  `;
  combatSection.appendChild(spellcastingSection);
  combatSection.appendChild(spellListSection);
  const abilityInputs = {
    str: abilitySection.querySelector('input[name="ability_str"]'),
    dex: abilitySection.querySelector('input[name="ability_dex"]'),
    con: abilitySection.querySelector('input[name="ability_con"]'),
    int: abilitySection.querySelector('input[name="ability_int"]'),
    wis: abilitySection.querySelector('input[name="ability_wis"]'),
    cha: abilitySection.querySelector('input[name="ability_cha"]')
  };
  const proficiencyInput = statsSection.querySelector('input[name="proficiency_bonus"]');
  const syncSpellcastingDerived = () => {
    const selectedAbility = spellcastingAbilitySelect.value;
    const abilityValue = selectedAbility ? abilityInputs[selectedAbility]?.value : null;
    const abilityMod = getAbilityModifier(abilityValue);
    const proficiencyBonus = normalizeNumber(proficiencyInput?.value);
    const saveValue = abilityMod === null || proficiencyBonus === null
      ? ''
      : String(8 + abilityMod + proficiencyBonus);
    const attackValue = abilityMod === null || proficiencyBonus === null
      ? ''
      : String(abilityMod + proficiencyBonus);
    if (spellSaveInput) spellSaveInput.value = saveValue;
    if (spellAttackInput) spellAttackInput.value = attackValue;
  };
  const toggleSpellcastingSection = () => {
    if (!spellcasterInput) return;
    spellcastingSection.style.display = spellcasterInput.checked ? '' : 'none';
  };
  spellcasterInput?.addEventListener('change', toggleSpellcastingSection);
  spellcastingAbilitySelect.addEventListener('change', syncSpellcastingDerived);
  Object.values(abilityInputs).forEach((input) => input?.addEventListener('input', syncSpellcastingDerived));
  proficiencyInput?.addEventListener('input', syncSpellcastingDerived);
  toggleSpellcastingSection();
  syncSpellcastingDerived();

  const proficiencyNotesSection = document.createElement('div');
  proficiencyNotesSection.className = 'character-edit-section';
  proficiencyNotesSection.appendChild(buildTextarea({
    label: 'Competenze (strumenti, lingue, ecc.)',
    name: 'proficiency_notes',
    placeholder: 'Es. Strumenti: kit da ladro, strumenti musicali; Lingue: comune, elfico',
    value: characterData.proficiency_notes ?? ''
  }));
  const languageNotesSection = document.createElement('div');
  languageNotesSection.className = 'character-edit-section';
  languageNotesSection.appendChild(buildTextarea({
    label: 'Lingue conosciute',
    name: 'language_proficiencies',
    placeholder: 'Es. comune, elfico, draconico',
    value: characterData.language_proficiencies ?? ''
  }));
  const talentNotesSection = document.createElement('div');
  talentNotesSection.className = 'character-edit-section';
  talentNotesSection.appendChild(buildTextarea({
    label: 'Talenti',
    name: 'talents',
    placeholder: 'Es. Maestro d\'armi, Tiratore scelto',
    value: characterData.talents ?? ''
  }));

  form.appendChild(buildEditGroup('Identità e background', [mainSection]));
  form.appendChild(buildEditGroup('Statistiche e difese', [statsSection, acSection]));
  form.appendChild(buildEditGroup('Caratteristiche e competenze', [
    abilitySection,
    skillSection,
    savingSection,
    proficiencySection
  ]));
  form.appendChild(buildEditGroup('Combattimento e magia', [combatSection]));
  form.appendChild(buildEditGroup('Note e dettagli', [
    proficiencyNotesSection,
    languageNotesSection,
    talentNotesSection
  ]));

  const modal = document.querySelector('[data-form-modal]');
  const modalCard = modal?.querySelector('.modal-card');
  modalCard?.classList.add('modal-card--wide');
  const formData = await openFormModal({
    title: character ? 'Modifica personaggio' : 'Nuovo personaggio',
    submitLabel: character ? 'Salva' : 'Crea',
    content: form
  });
  modalCard?.classList.remove('modal-card--wide');
  if (!formData) return;
  const name = formData.get('name')?.trim();
  if (!name) {
    createToast('Inserisci un nome per il personaggio', 'error');
    return;
  }
  const toNumberOrNull = (value) => (value === '' ? null : Number(value));
  const nextSkills = { ...characterData.skills };
  const nextMastery = { ...characterData.skill_mastery };
  skillList.forEach((skill) => {
    const masteryChecked = formData.has(`mastery_${skill.key}`);
    const proficiencyChecked = formData.has(`skill_${skill.key}`) || masteryChecked;
    nextSkills[skill.key] = proficiencyChecked;
    nextMastery[skill.key] = masteryChecked && proficiencyChecked;
  });
  const nextSaving = { ...characterData.saving_throws };
  savingThrowList.forEach((save) => {
    nextSaving[save.key] = formData.has(`save_${save.key}`);
  });
  const nextProficiencies = { ...characterData.proficiencies };
  equipmentProficiencyList.forEach((prof) => {
    nextProficiencies[prof.key] = formData.has(`prof_${prof.key}`);
  });
  const nextAcModifiers = { ...characterData.ac_ability_modifiers };
  ['str', 'con', 'int', 'wis', 'cha'].forEach((ability) => {
    nextAcModifiers[ability] = formData.has(`ac_mod_${ability}`);
  });
  const isSpellcaster = formData.get('is_spellcaster') === 'on';
  const spellSlotLevels = Array.from({ length: 9 }, (_, index) => index + 1);
  const nextSpellcasting = isSpellcaster
    ? {
      ability: formData.get('spellcasting_ability') || null,
      recharge: formData.get('spell_slot_recharge') || 'long_rest',
      slots: spellSlotLevels.reduce((acc, level) => {
        acc[level] = toNumberOrNull(formData.get(`spell_slot_${level}`)) ?? 0;
        return acc;
      }, {}),
      slots_max: spellSlotLevels.reduce((acc, level) => {
        acc[level] = toNumberOrNull(formData.get(`spell_slot_${level}`)) ?? 0;
        return acc;
      }, {})
    }
    : characterData.spellcasting ?? null;
  const nextData = {
    ...characterData,
    avatar_url: formData.get('avatar_url')?.trim() || null,
    description: formData.get('description')?.trim() || null,
    hp: {
      current: toNumberOrNull(formData.get('hp_current')),
      temp: toNumberOrNull(formData.get('hp_temp')),
      max: toNumberOrNull(formData.get('hp_max'))
    },
    hit_dice: {
      die: formData.get('hit_dice_die')?.trim() || null,
      max: toNumberOrNull(formData.get('hit_dice_max')),
      used: toNumberOrNull(formData.get('hit_dice_used'))
    },
    ac: toNumberOrNull(formData.get('ac')),
    level: toNumberOrNull(formData.get('level')),
    race: formData.get('race')?.trim() || null,
    alignment: formData.get('alignment')?.trim() || null,
    background: formData.get('background')?.trim() || null,
    class_name: formData.get('class_name')?.trim() || null,
    archetype: formData.get('archetype')?.trim() || null,
    speed: toNumberOrNull(formData.get('speed')),
    proficiency_bonus: toNumberOrNull(formData.get('proficiency_bonus')),
    initiative: toNumberOrNull(formData.get('initiative')),
    attack_bonus_melee: toNumberOrNull(formData.get('attack_bonus_melee')) ?? 0,
    attack_bonus_ranged: toNumberOrNull(formData.get('attack_bonus_ranged')) ?? 0,
    extra_attacks: toNumberOrNull(formData.get('extra_attacks')) ?? 0,
    damage_bonus_melee: toNumberOrNull(formData.get('damage_bonus_melee')) ?? 0,
    damage_bonus_ranged: toNumberOrNull(formData.get('damage_bonus_ranged')) ?? 0,
    ac_bonus: toNumberOrNull(formData.get('ac_bonus')) ?? 0,
    is_spellcaster: isSpellcaster,
    spell_notes: formData.get('spell_notes')?.trim() || null,
    spellcasting: nextSpellcasting,
    ac_ability_modifiers: nextAcModifiers,
    proficiency_notes: formData.get('proficiency_notes')?.trim() || null,
    language_proficiencies: formData.get('language_proficiencies')?.trim() || null,
    talents: formData.get('talents')?.trim() || null,
    spells: currentSpells.filter((spell) => !formData.has(`remove_spell_${spell.id}`)),
    abilities: {
      str: toNumberOrNull(formData.get('ability_str')),
      dex: toNumberOrNull(formData.get('ability_dex')),
      con: toNumberOrNull(formData.get('ability_con')),
      int: toNumberOrNull(formData.get('ability_int')),
      wis: toNumberOrNull(formData.get('ability_wis')),
      cha: toNumberOrNull(formData.get('ability_cha'))
    },
    skills: nextSkills,
    skill_mastery: nextMastery,
    saving_throws: nextSaving,
    proficiencies: nextProficiencies
  };
  const payload = {
    name,
    system: formData.get('system')?.trim() || null,
    data: nextData
  };

  try {
    if (character) {
      const updated = await updateCharacter(character.id, payload);
      const nextCharacters = getState().characters.map((char) => (char.id === updated.id ? updated : char));
      setState({ characters: nextCharacters });
      await cacheSnapshot({ characters: nextCharacters });
      createToast('Personaggio aggiornato');
    } else {
      const created = await createCharacter({ ...payload, user_id: user.id });
      const nextCharacters = [...getState().characters, created];
      setState({ characters: nextCharacters });
      setActiveCharacter(created.id);
      await cacheSnapshot({ characters: nextCharacters });
      createToast('Personaggio creato');
    }
    onSave();
  } catch (error) {
    createToast(character ? 'Errore aggiornamento personaggio' : 'Errore creazione personaggio', 'error');
  }
}

function buildCharacterOverview(character, canEditCharacter, items = []) {
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
            <span>Velocità</span>
            <strong>${data.speed ?? '-'}</strong>
          </div>
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
        ${buildProficiencyOverview(character)}
      </div>
      <div class="home-section">
        <header class="card-header">
          <div>
            <p class="eyebrow">Talenti</p>
          </div>
        </header>
        ${buildTalentOverview(character)}
      </div>
    </div>
  `;
}

function openBackgroundModal(character) {
  if (!character) return;
  const data = character.data || {};
  const background = data.background || 'Background non impostato.';
  const description = data.description || 'Aggiungi una descrizione del background.';
  const content = document.createElement('div');
  content.className = 'background-modal';

  const backgroundCard = document.createElement('div');
  backgroundCard.className = 'detail-card detail-card--text';
  const backgroundBlock = document.createElement('div');
  backgroundBlock.className = 'background-modal-block';
  const backgroundTitle = document.createElement('strong');
  backgroundTitle.textContent = 'Background';
  const backgroundText = document.createElement('p');
  backgroundText.textContent = background;
  backgroundBlock.appendChild(backgroundTitle);
  backgroundBlock.appendChild(backgroundText);
  backgroundCard.appendChild(backgroundBlock);

  const descriptionCard = document.createElement('div');
  descriptionCard.className = 'detail-card detail-card--text';
  const descriptionBlock = document.createElement('div');
  descriptionBlock.className = 'background-modal-block';
  const descriptionTitle = document.createElement('strong');
  descriptionTitle.textContent = 'Descrizione';
  const descriptionText = document.createElement('p');
  descriptionText.textContent = description;
  descriptionBlock.appendChild(descriptionTitle);
  descriptionBlock.appendChild(descriptionText);
  descriptionCard.appendChild(descriptionBlock);

  content.appendChild(backgroundCard);
  content.appendChild(descriptionCard);

  openFormModal({
    title: 'Background',
    submitLabel: 'Chiudi',
    cancelLabel: null,
    content,
    cardClass: 'modal-card--scrollable'
  });
}

function buildSkillList(character) {
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

function buildSavingThrowSection(character) {
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

function buildProficiencyOverview(character) {
  const data = character.data || {};
  const proficiencies = data.proficiencies || {};
  const notes = data.proficiency_notes || '';
  const { tools, languages: legacyLanguages } = parseProficiencyNotesSections(notes);
  const languageNotes = data.language_proficiencies || '';
  const explicitLanguages = parseProficiencyNotes(languageNotes);
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

  return `
    <div class="detail-section">
      <div class="accordion-stack">
        <details class="accordion">
          <summary>Equipaggiamento</summary>
          <div class="detail-card detail-card--text">
            ${equipped.length
    ? `<div class="tag-row">${equipped.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Nessuna competenza equipaggiamento.</p>'}
          </div>
        </details>
        <details class="accordion">
          <summary>Strumenti</summary>
          <div class="detail-card detail-card--text">
            ${tools.length
    ? `<div class="tag-row">${tools.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi strumenti nel profilo.</p>'}
          </div>
        </details>
        <details class="accordion">
          <summary>Lingue</summary>
          <div class="detail-card detail-card--text">
            ${languages.length
    ? `<div class="tag-row">${languages.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi lingue conosciute nel profilo.</p>'}
          </div>
        </details>
      </div>
    </div>
  `;
}

function buildTalentOverview(character) {
  const data = character.data || {};
  const talentNotes = data.talents || '';
  const talents = parseProficiencyNotes(talentNotes);

  return `
    <div class="detail-section">
      <div class="detail-card detail-card--text">
        ${talents.length
    ? `<div class="tag-row">${talents.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi talenti nel profilo.</p>'}
      </div>
    </div>
  `;
}

function buildAttackSection(character, items = []) {
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

function buildSpellSection(character) {
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

function sortSpellsByLevel(spells) {
  return [...spells].sort((a, b) => {
    const levelDiff = Number(a.level) - Number(b.level);
    if (levelDiff !== 0) return levelDiff;
    return (a.name ?? '').localeCompare(b.name ?? '', 'it', { sensitivity: 'base' });
  });
}

function getSpellTypeLabel(spell) {
  const isCantrip = spell.kind === 'cantrip' || Number(spell.level) === 0;
  return isCantrip ? 'Trucchetto' : 'Incantesimo';
}

async function consumeSpellSlot(character, level, container) {
  if (!character) return false;
  const data = character.data || {};
  const spellcasting = data.spellcasting || {};
  const slots = { ...(spellcasting.slots || {}) };
  const slotsMax = { ...(spellcasting.slots_max || {}) };
  const current = Math.max(0, Number(slots[level]) || 0);
  if (!current) {
    createToast('Slot incantesimo esauriti', 'error');
    return false;
  }
  const currentMax = Number(slotsMax[level]);
  if (!Number.isFinite(currentMax) || currentMax < current) {
    slotsMax[level] = current;
  }
  slots[level] = Math.max(0, current - 1);
  await saveCharacterData(character, {
    ...data,
    spellcasting: {
      ...spellcasting,
      slots,
      slots_max: slotsMax
    }
  }, 'Slot incantesimo consumato', container);
  return true;
}

function openSpellListModal(character, container) {
  if (!character) return;
  const data = character.data || {};
  const spells = Array.isArray(data.spells) ? sortSpellsByLevel(data.spells) : [];
  const content = document.createElement('div');
  content.className = 'spell-list-modal';
  if (!spells.length) {
    content.innerHTML = '<p class="muted">Nessun incantesimo configurato.</p>';
  } else {
    const grouped = spells.reduce((acc, spell) => {
      const level = Number(spell.level) || 0;
      acc[level] = acc[level] || [];
      acc[level].push(spell);
      return acc;
    }, {});
    const levels = Object.keys(grouped).map(Number).sort((a, b) => a - b);
    content.innerHTML = levels.map((level) => {
      const title = level === 0 ? 'Trucchetti' : `Incantesimi di livello ${level}°`;
      return `
        <section class="spell-list-modal__section">
          <h4>${title}</h4>
          <div class="spell-list-modal__items">
            ${grouped[level].map((spell) => {
    const typeLabel = getSpellTypeLabel(spell);
    const damageModifier = Number(spell.damage_modifier) || 0;
    const damageText = spell.damage_die
      ? `${spell.damage_die}${damageModifier ? ` ${formatSigned(damageModifier)}` : ''}`
      : null;
    const attackLabel = spell.attack_roll ? 'Tiro per colpire' : null;
    return `
              <div class="spell-list-modal__item">
                <div class="spell-list-modal__item-info">
                  <div class="spell-list-modal__item-title">
                    <strong>${spell.name}</strong>
                    <span class="chip chip--small">${typeLabel}</span>
                  </div>
                  <div class="spell-list-modal__item-meta">
                    ${attackLabel ? `<span>${attackLabel}</span>` : ''}
                    ${damageText ? `<span>Danni ${damageText}</span>` : ''}
                  </div>
                </div>
                ${level > 0
    ? `<button class="resource-cta-button resource-cta-button--label" type="button" data-spell-cast="${spell.id}">Lancia</button>`
    : ''}
              </div>
            `;
  }).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  openFormModal({
    title: 'Lista incantesimi',
    submitLabel: 'Chiudi',
    cancelLabel: null,
    content,
    cardClass: 'spell-list-modal-card'
  });

  const modal = document.querySelector('[data-form-modal]');
  const closeModal = () => {
    modal?.querySelector('[data-form-submit]')?.click();
  };

  content.querySelectorAll('[data-spell-cast]')
    .forEach((button) => button.addEventListener('click', async () => {
      const spell = spells.find((entry) => entry.id === button.dataset.spellCast);
      if (!spell) return;
      const level = Number(spell.level) || 0;
      if (level < 1) return;
      const consumed = await consumeSpellSlot(character, level, container);
      if (consumed) {
        closeModal();
      }
    }));
}

function openSpellDrawer(character, onSave) {
  if (!character) return;
  const form = document.createElement('div');
  form.className = 'drawer-form';
  const spellKindField = document.createElement('label');
  spellKindField.className = 'field';
  spellKindField.innerHTML = '<span>Tipo incantesimo</span>';
  const spellKindSelect = buildSelect([
    { value: 'cantrip', label: 'Trucchetto' },
    { value: 'spell', label: 'Incantesimo' }
  ], 'spell');
  spellKindSelect.name = 'spell_kind';
  spellKindField.appendChild(spellKindSelect);
  form.appendChild(spellKindField);
  const nameField = buildInput({
    label: 'Nome incantesimo',
    name: 'spell_name',
    placeholder: 'Es. Palla di fuoco'
  });
  const nameInput = nameField.querySelector('input');
  if (nameInput) {
    nameInput.required = true;
  }
  form.appendChild(nameField);
  const levelField = buildInput({
    label: 'Livello incantesimo',
    name: 'spell_level',
    type: 'number',
    value: 1
  });
  const levelInput = levelField.querySelector('input');
  if (levelInput) {
    levelInput.min = '1';
    levelInput.max = '9';
  }
  form.appendChild(levelField);
  form.appendChild(buildInput({
    label: 'Tempo di lancio',
    name: 'spell_cast_time',
    placeholder: 'Es. 1 azione'
  }));
  form.appendChild(buildInput({
    label: 'Durata',
    name: 'spell_duration',
    placeholder: 'Es. 1 minuto'
  }));
  form.appendChild(buildInput({
    label: 'Range',
    name: 'spell_range',
    placeholder: 'Es. 18 m'
  }));
  const concentrationField = document.createElement('label');
  concentrationField.className = 'checkbox';
  concentrationField.innerHTML = '<input type="checkbox" name="spell_concentration" /> <span>Concentrazione</span>';
  form.appendChild(concentrationField);
  const attackRollField = document.createElement('label');
  attackRollField.className = 'checkbox';
  attackRollField.innerHTML = '<input type="checkbox" name="spell_attack_roll" /> <span>Tiro per colpire (targhet)</span>';
  form.appendChild(attackRollField);
  form.appendChild(buildInput({
    label: 'Dado danno',
    name: 'spell_damage_die',
    placeholder: 'Es. 1d10'
  }));
  form.appendChild(buildInput({
    label: 'Modificatore danni',
    name: 'spell_damage_modifier',
    type: 'number',
    value: ''
  }));
  form.appendChild(buildTextarea({
    label: 'Descrizione',
    name: 'spell_description',
    placeholder: 'Descrizione dell\'incantesimo...'
  }));

  const syncSpellKind = () => {
    if (!levelInput) return;
    if (spellKindSelect.value === 'cantrip') {
      levelInput.value = '0';
      levelInput.min = '0';
      levelInput.max = '0';
      levelInput.readOnly = true;
      levelInput.disabled = true;
    } else {
      if (Number(levelInput.value) === 0) {
        levelInput.value = '1';
      }
      levelInput.min = '1';
      levelInput.max = '9';
      levelInput.readOnly = false;
      levelInput.disabled = false;
    }
  };
  spellKindSelect.addEventListener('change', syncSpellKind);
  syncSpellKind();

  openFormModal({
    title: 'Nuovo incantesimo',
    submitLabel: 'Aggiungi',
    content: form
  }).then(async (formData) => {
    if (!formData) return;
    const name = formData.get('spell_name')?.trim();
    if (!name) {
      createToast('Inserisci un nome per l\'incantesimo', 'error');
      return;
    }
    const toNumberOrNull = (value) => (value === '' || value === null ? null : Number(value));
    const selectedKind = formData.get('spell_kind') || null;
    const rawLevel = toNumberOrNull(formData.get('spell_level')) ?? 0;
    const level = selectedKind === 'cantrip'
      ? 0
      : Math.min(9, Math.max(1, rawLevel || 1));
    const damageModifier = toNumberOrNull(formData.get('spell_damage_modifier'));
    const nextSpell = {
      id: `spell-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      level,
      kind: selectedKind || (level === 0 ? 'cantrip' : 'spell'),
      cast_time: formData.get('spell_cast_time')?.trim() || null,
      duration: formData.get('spell_duration')?.trim() || null,
      range: formData.get('spell_range')?.trim() || null,
      concentration: formData.has('spell_concentration'),
      attack_roll: formData.has('spell_attack_roll'),
      damage_die: formData.get('spell_damage_die')?.trim() || null,
      damage_modifier: damageModifier,
      description: formData.get('spell_description')?.trim() || null
    };
    const nextSpells = Array.isArray(character.data?.spells)
      ? [...character.data.spells, nextSpell]
      : [nextSpell];
    const nextData = {
      ...character.data,
      spells: nextSpells
    };
    await saveCharacterData(character, nextData, 'Incantesimo aggiunto');
    if (onSave) {
      onSave();
    }
  });
}

function buildHpShortcutFields(
  character,
  {
    allowHitDice = true,
    allowTempHp = false,
    allowMaxOverride = false
  } = {}
) {
  const wrapper = document.createElement('div');
  const amountField = buildInput({ label: 'Valore', name: 'amount', type: 'number', value: '1' });
  const amountInput = amountField.querySelector('input');
  if (amountInput) {
    amountInput.min = '1';
    amountInput.required = true;
  }
  wrapper.appendChild(amountField);

  if (allowTempHp) {
    const tempHpField = document.createElement('label');
    tempHpField.className = 'checkbox';
    tempHpField.innerHTML = `
      <input type="checkbox" name="temp_hp" />
      <span>HP temporanei</span>
    `;
    wrapper.appendChild(tempHpField);
  }

  if (!allowHitDice) {
    if (allowMaxOverride) {
      const maxHpField = buildInput({
        label: 'Nuovo massimo PF',
        name: 'hp_max_override',
        type: 'number',
        value: ''
      });
      const maxInput = maxHpField.querySelector('input');
      if (maxInput) {
        maxInput.min = '1';
      }
      wrapper.appendChild(maxHpField);
    }
    return wrapper;
  }

  const hitDice = character?.data?.hit_dice || {};
  const hitDiceUsed = Number(hitDice.used) || 0;
  const hitDiceMax = Number(hitDice.max) || 0;
  const remaining = Math.max(hitDiceMax - hitDiceUsed, 0);
  const hitDiceSides = getHitDiceSides(hitDice.die);
  const canUse = remaining > 0 && hitDiceSides;

  const hitDiceField = document.createElement('label');
  hitDiceField.className = 'checkbox';
  const hitDiceLabel = hitDice.die ? `${hitDice.die}` : 'dado vita';
  hitDiceField.innerHTML = `
    <input type="checkbox" name="use_hit_dice" ${canUse ? '' : 'disabled'} />
    <span>Usa dado vita (${hitDiceLabel}) · rimasti ${remaining}/${hitDiceMax || '-'}</span>
  `;
  wrapper.appendChild(hitDiceField);

  const hitDiceCountField = document.createElement('label');
  hitDiceCountField.className = 'field hit-dice-count';
  hitDiceCountField.innerHTML = `
    <span>Numero dadi vita</span>
    <input type="number" name="hit_dice_count" min="1" max="${remaining}" value="1" />
  `;
  wrapper.appendChild(hitDiceCountField);

  if (!canUse) {
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'Nessun dado vita disponibile o configurato.';
    wrapper.appendChild(hint);
  }

  const checkbox = hitDiceField.querySelector('input');
  const countInput = hitDiceCountField.querySelector('input');
  if (countInput) {
    countInput.required = false;
  }

  const syncState = () => {
    const useDice = checkbox?.checked;
    if (!amountInput) return;
    amountInput.disabled = Boolean(useDice);
    amountInput.required = !useDice;
    if (useDice) {
      amountInput.value = '';
    } else if (!amountInput.value) {
      amountInput.value = '1';
    }
    if (countInput) {
      countInput.disabled = !useDice;
      countInput.required = Boolean(useDice);
      if (!useDice) {
        countInput.value = '1';
      }
    }
    hitDiceCountField.style.display = useDice ? 'grid' : 'none';
  };
  checkbox?.addEventListener('change', syncState);
  syncState();

  return wrapper;
}

const RESOURCE_CAST_TIME_ORDER = [
  { label: 'Azione Gratuita', className: 'resource-chip--free' },
  { label: 'Azione Bonus', className: 'resource-chip--bonus' },
  { label: 'Reazione', className: 'resource-chip--reaction' },
  { label: 'Azione', className: 'resource-chip--action' }
];

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

function buildResourceList(
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
            ` : ''}
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function buildResourceSections(resources, canManageResources) {
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
          ${buildResourceList(activeResources, canManageResources)}
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

function buildResourceCharges(resource) {
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

function openResourceDrawer(character, onSave, resource = null) {
  if (!character) return;
  const form = document.createElement('div');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome abilità', name: 'name', placeholder: 'Es. Ispirazione', value: resource?.name ?? '' }));
  form.appendChild(buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../risorsa.png',
    value: resource?.image_url ?? ''
  }));
  form.appendChild(buildTextarea({
    label: 'Descrizione',
    name: 'description',
    placeholder: 'Inserisci una descrizione...',
    value: resource?.description ?? ''
  }));
  const passiveField = document.createElement('label');
  passiveField.className = 'checkbox';
  passiveField.innerHTML = '<input type="checkbox" name="is_passive" /> <span>Passiva (senza cariche)</span>';
  form.appendChild(passiveField);
  const castTimeField = document.createElement('label');
  castTimeField.className = 'field';
  castTimeField.innerHTML = '<span>Tipo di lancio</span>';
  const castTimeSelect = buildSelect([
    { value: 'Azione', label: 'Azione' },
    { value: 'Reazione', label: 'Reazione' },
    { value: 'Azione Bonus', label: 'Azione Bonus' },
    { value: 'Azione Gratuita', label: 'Azione Gratuita' }
  ], resource?.cast_time ?? 'Azione');
  castTimeSelect.name = 'cast_time';
  castTimeField.appendChild(castTimeSelect);
  form.appendChild(castTimeField);
  form.appendChild(buildInput({ label: 'Cariche massime', name: 'max_uses', type: 'number', value: resource?.max_uses ?? 1 }));
  form.appendChild(buildInput({ label: 'Cariche consumate', name: 'used', type: 'number', value: resource?.used ?? 0 }));

  const recoveryGrid = document.createElement('div');
  recoveryGrid.className = 'compact-field-grid';
  recoveryGrid.appendChild(buildInput({
    label: 'Recupero riposo breve',
    name: 'recovery_short',
    type: 'number',
    value: resource?.recovery_short ?? ''
  }));
  recoveryGrid.appendChild(buildInput({
    label: 'Recupero riposo lungo',
    name: 'recovery_long',
    type: 'number',
    value: resource?.recovery_long ?? ''
  }));
  form.appendChild(recoveryGrid);

  const resetField = document.createElement('label');
  resetField.className = 'field';
  resetField.innerHTML = '<span>Tipo ricarica</span>';
  const resetSelect = buildSelect([
    { value: 'short_rest', label: 'Riposo breve' },
    { value: 'long_rest', label: 'Riposo lungo' }
  ], resource?.reset_on ?? 'long_rest');
  resetSelect.name = 'reset_on';
  resetField.appendChild(resetSelect);
  form.appendChild(resetField);

  const maxUsesInput = form.querySelector('input[name="max_uses"]');
  const usedInput = form.querySelector('input[name="used"]');
  const recoveryShortInput = form.querySelector('input[name="recovery_short"]');
  const recoveryLongInput = form.querySelector('input[name="recovery_long"]');
  const passiveInput = form.querySelector('input[name="is_passive"]');
  if (passiveInput) {
    passiveInput.checked = Number(resource?.max_uses) === 0 || resource?.reset_on === null || resource?.reset_on === 'none';
  }
  const syncPassiveState = () => {
    const isPassive = passiveInput?.checked;
    if (isPassive) {
      if (maxUsesInput) maxUsesInput.value = '0';
      if (usedInput) usedInput.value = '0';
      if (recoveryShortInput) recoveryShortInput.value = '0';
      if (recoveryLongInput) recoveryLongInput.value = '0';
    }
    if (maxUsesInput) maxUsesInput.disabled = isPassive;
    if (usedInput) usedInput.disabled = isPassive;
    if (recoveryShortInput) recoveryShortInput.disabled = isPassive;
    if (recoveryLongInput) recoveryLongInput.disabled = isPassive;
    resetSelect.disabled = isPassive;
  };
  passiveInput?.addEventListener('change', syncPassiveState);
  syncPassiveState();

  if (resource) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'resource-action-button resource-delete-button';
    deleteButton.textContent = 'Elimina';
    deleteButton.addEventListener('click', async () => {
      const shouldDelete = await openConfirmModal({ message: 'Eliminare risorsa?' });
      if (!shouldDelete) return;
      try {
        await deleteResource(resource.id);
        createToast('Risorsa eliminata');
        onSave();
        const modal = document.querySelector('[data-form-modal]');
        const cancelButton = modal?.querySelector('[data-form-cancel]');
        cancelButton?.click();
      } catch (error) {
        createToast('Errore eliminazione risorsa', 'error');
      }
    });
    const deleteWrapper = document.createElement('div');
    deleteWrapper.className = 'resource-form-actions';
    deleteWrapper.appendChild(deleteButton);
    form.appendChild(deleteWrapper);
  }

  openFormModal({
    title: resource ? 'Modifica abilità' : 'Nuova abilità',
    submitLabel: resource ? 'Salva' : 'Crea',
    content: form
  }).then(async (formData) => {
    if (!formData) return;
    const name = formData.get('name')?.trim();
    if (!name) {
      createToast('Inserisci un nome per la risorsa', 'error');
      return;
    }
    const currentUser = getState().user;
    const toNumberOrNull = (value) => (value === '' || value === null ? null : Number(value));
    const maxUses = Number(formData.get('max_uses')) || 0;
    const used = Math.min(Number(formData.get('used')) || 0, maxUses || 0);
    const isPassive = formData.get('is_passive') === 'on';
    const payload = {
      user_id: currentUser?.id ?? character.user_id,
      character_id: character.id,
      name,
      image_url: formData.get('image_url')?.trim() || null,
      description: formData.get('description')?.trim() || null,
      cast_time: formData.get('cast_time') || null,
      max_uses: maxUses,
      used,
      reset_on: isPassive ? null : formData.get('reset_on'),
      recovery_short: toNumberOrNull(formData.get('recovery_short')),
      recovery_long: toNumberOrNull(formData.get('recovery_long'))
    };

    try {
      if (resource) {
        await updateResource(resource.id, payload);
        createToast('Risorsa aggiornata');
      } else {
        await createResource(payload);
        createToast('Risorsa creata');
      }
      onSave();
    } catch (error) {
      createToast('Errore salvataggio risorsa', 'error');
    }
  });
}

const abilityShortLabel = {
  str: 'FOR',
  dex: 'DES',
  con: 'COS',
  int: 'INT',
  wis: 'SAG',
  cha: 'CAR'
};

const skillList = [
  { key: 'acrobatics', label: 'Acrobazia', ability: 'dex' },
  { key: 'animal_handling', label: 'Addestrare animali', ability: 'wis' },
  { key: 'arcana', label: 'Arcano', ability: 'int' },
  { key: 'athletics', label: 'Atletica', ability: 'str' },
  { key: 'deception', label: 'Inganno', ability: 'cha' },
  { key: 'history', label: 'Storia', ability: 'int' },
  { key: 'insight', label: 'Intuizione', ability: 'wis' },
  { key: 'intimidation', label: 'Intimidire', ability: 'cha' },
  { key: 'investigation', label: 'Indagare', ability: 'int' },
  { key: 'medicine', label: 'Medicina', ability: 'wis' },
  { key: 'nature', label: 'Natura', ability: 'int' },
  { key: 'perception', label: 'Percezione', ability: 'wis' },
  { key: 'performance', label: 'Intrattenere', ability: 'cha' },
  { key: 'persuasion', label: 'Persuasione', ability: 'cha' },
  { key: 'religion', label: 'Religione', ability: 'int' },
  { key: 'sleight_of_hand', label: 'Rapidità di mano', ability: 'dex' },
  { key: 'stealth', label: 'Furtività', ability: 'dex' },
  { key: 'survival', label: 'Sopravvivenza', ability: 'wis' }
];

const savingThrowList = [
  { key: 'str', label: 'Forza' },
  { key: 'dex', label: 'Destrezza' },
  { key: 'con', label: 'Costituzione' },
  { key: 'int', label: 'Intelligenza' },
  { key: 'wis', label: 'Saggezza' },
  { key: 'cha', label: 'Carisma' }
];

const equipmentProficiencyList = [
  { key: 'weapon_simple', label: 'Armi semplici' },
  { key: 'weapon_martial', label: 'Armi da guerra' },
  { key: 'armor_light', label: 'Armature leggere' },
  { key: 'armor_medium', label: 'Armature medie' },
  { key: 'armor_heavy', label: 'Armature pesanti' },
  { key: 'shield', label: 'Scudi' }
];

function parseProficiencyNotes(notes) {
  if (!notes) return [];
  return notes
    .split(/[,;\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseProficiencyNotesSections(notes) {
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

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function getAbilityModifier(value) {
  const score = normalizeNumber(value);
  if (score === null) return null;
  return Math.floor((score - 10) / 2);
}

function calculateSkillModifier(score, proficiencyBonus, proficiencyMultiplier) {
  const base = getAbilityModifier(score);
  if (base === null) return null;
  const bonus = proficiencyMultiplier > 0 && proficiencyBonus !== null
    ? proficiencyBonus * proficiencyMultiplier
    : 0;
  return base + bonus;
}

function calculatePassivePerception(abilities, proficiencyBonus, skillStates, skillMasteryStates) {
  const hasProficiency = Boolean(skillStates.perception);
  const mastery = Boolean(skillMasteryStates.perception);
  const total = calculateSkillModifier(abilities.wis, proficiencyBonus, hasProficiency ? (mastery ? 2 : 1) : 0);
  if (total === null) return null;
  return 10 + total;
}

function getHitDiceSides(hitDiceDie) {
  if (!hitDiceDie || typeof hitDiceDie !== 'string') return null;
  const match = hitDiceDie.trim().match(/d(\d+)/i);
  if (!match) return null;
  const sides = Number(match[1]);
  return Number.isNaN(sides) ? null : sides;
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function parseDamageDice(damageDie) {
  if (!damageDie || typeof damageDie !== 'string') return null;
  const match = damageDie.trim().match(/(\d+)d(\d+)/i);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides) || !count || !sides) return null;
  return { count, sides };
}

function buildWeaponDamageOverlayConfig(character, weapon) {
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

function buildSpellDamageOverlayConfig(spell) {
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

function calculateWeaponDamageRoll(character, weapon) {
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

function calculateSpellDamageRoll(spell) {
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

function applyRestRecovery(data, resetOn) {
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

function formatSigned(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatAbility(value) {
  if (value === null || value === undefined || value === '') return '-';
  const score = normalizeNumber(value);
  if (score === null) return '-';
  const modifier = formatModifier(score);
  return `${score} (${modifier})`;
}

function formatModifier(score) {
  const mod = getAbilityModifier(score);
  return formatSigned(mod);
}

function formatHitDice(hitDice) {
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

function calculateArmorClass(data, abilities, items) {
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

function getEquipSlots(item) {
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

function formatResourceRecovery(resource) {
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
