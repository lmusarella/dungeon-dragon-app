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
          </header>
          ${activeCharacter ? buildSavingThrowSection(activeCharacter) : '<p>Nessun personaggio selezionato.</p>'}
        </section>
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Abilità</p>            
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
              ${characters.length > 1 ? '<select data-character-select></select>' : ''}
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
              <p class="eyebrow">Risorse</p>           
            </div>
            ${activeCharacter && canManageResources ? `
              <button class="icon-button icon-button--add" data-add-resource aria-label="Nuova risorsa">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </header>
          <div class="home-scroll-body">
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

  const select = container.querySelector('[data-character-select]');
  if (select) {
    characters.forEach((character) => {
      const option = document.createElement('option');
      option.value = character.id;
      option.textContent = character.name;
      if (character.id === activeCharacter?.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', (event) => {
      setActiveCharacter(event.target.value);
      renderHome(container);
    });
  }

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

  container.querySelectorAll('[data-edit-resource]')
    .forEach((button) => button.addEventListener('click', () => {
      const resource = resources.find((entry) => entry.id === button.dataset.editResource);
      if (!resource) return;
      openResourceDrawer(activeCharacter, () => renderHome(container), resource);
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
          const maxUses = Number(resource.max_uses) || 0;
          if (!maxUses || resource.used >= maxUses) return;
          const shouldUse = await openConfirmModal({ message: 'Usare la risorsa?' });
          if (!shouldUse) return;
          try {
            await updateResource(resource.id, { used: Math.min(resource.used + 1, maxUses) });
            createToast('Risorsa usata');
            renderHome(container);
          } catch (error) {
            createToast('Errore utilizzo risorsa', 'error');
          }
        }, longPressDelay);
      };
      const cancelPress = () => {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      card.addEventListener('pointerdown', startPress);
      card.addEventListener('pointerup', cancelPress);
      card.addEventListener('pointerleave', cancelPress);
      card.addEventListener('pointercancel', cancelPress);
      card.addEventListener('pointermove', cancelPress);
    });

  container.querySelectorAll('[data-delete-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.deleteResource);
      if (!resource) return;
      const shouldDelete = await openConfirmModal({ message: 'Eliminare risorsa?' });
      if (!shouldDelete) return;
      try {
        await deleteResource(resource.id);
        createToast('Risorsa eliminata');
        renderHome(container);
      } catch (error) {
        createToast('Errore eliminazione risorsa', 'error');
      }
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

function handleDiceAction(type) {
  const titles = {
    'saving-throws': 'Tiri salvezza',
    skills: 'Abilità',
    roller: 'Lancia dadi'
  };
  openDiceRollerModal(titles[type] ?? 'Lancia dadi');
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
    if (resetOn === 'long_rest') {
      const nextData = applyLongRestRecovery(activeCharacter.data);
      if (nextData) {
        await saveCharacterData(activeCharacter, nextData, null, container);
        return;
      }
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
    content: buildHpShortcutFields(activeCharacter, action === 'heal')
  });
  if (!formData) return;
  const useHitDice = formData.has('use_hit_dice');
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
  const maxHp = activeCharacter.data?.hp?.max;
  const nextHp = action === 'heal'
    ? currentHp + amount
    : Math.max(currentHp - amount, 0);
  const adjusted = maxHp !== null && maxHp !== undefined
    ? Math.min(nextHp, Number(maxHp))
    : nextHp;
  const nextHitDice = action === 'heal' && useHitDice
    ? {
      ...hitDice,
      used: Math.min(hitDiceUsed + diceCount, hitDiceMax)
    }
    : hitDice;
  const message = action === 'heal'
    ? `PF curati +${amount}${useHitDice ? ` (${diceCount}d${hitDiceSides})` : ''}`
    : `Danno ${amount}`;
  await saveCharacterData(activeCharacter, {
    ...activeCharacter.data,
    hp: {
      ...activeCharacter.data?.hp,
      current: adjusted
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
      <h4>${resource.name}</h4>
      <p class="muted">${formatResourceRecovery(resource)}</p>
      <p>Cariche: ${usageLabel}</p>
    </div>
  `;
  openFormModal({
    title: 'Dettaglio risorsa',
    submitLabel: 'Chiudi',
    content: detail
  });
}

function openDiceRollerModal(title) {
  const content = document.createElement('div');
  content.className = 'dice-roller-modal';
  openFormModal({
    title,
    submitLabel: 'Chiudi',
    content
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
  const form = document.createElement('div');
  form.className = 'character-edit-form';

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
    label: 'Descrizione',
    name: 'description',
    placeholder: 'Aspetto, tratti distintivi, background...',
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

  const proficiencyNotesSection = document.createElement('div');
  proficiencyNotesSection.className = 'character-edit-section';
  proficiencyNotesSection.appendChild(buildTextarea({
    label: 'Competenze (strumenti, lingue, ecc.)',
    name: 'proficiency_notes',
    placeholder: 'Es. kit da ladro, strumenti musicali, linguaggi conosciuti...',
    value: characterData.proficiency_notes ?? ''
  }));

  form.appendChild(mainSection);
  form.appendChild(statsSection);
  form.appendChild(acSection);
  form.appendChild(abilitySection);
  form.appendChild(skillSection);
  form.appendChild(savingSection);
  form.appendChild(proficiencySection);
  form.appendChild(proficiencyNotesSection);

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
  const nextData = {
    ...characterData,
    avatar_url: formData.get('avatar_url')?.trim() || null,
    description: formData.get('description')?.trim() || null,
    hp: {
      current: toNumberOrNull(formData.get('hp_current')),
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
    class_name: formData.get('class_name')?.trim() || null,
    archetype: formData.get('archetype')?.trim() || null,
    speed: toNumberOrNull(formData.get('speed')),
    proficiency_bonus: toNumberOrNull(formData.get('proficiency_bonus')),
    initiative: toNumberOrNull(formData.get('initiative')),
    ac_ability_modifiers: nextAcModifiers,
    proficiency_notes: formData.get('proficiency_notes')?.trim() || null,
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
  const initiativeBonus = data.initiative ?? getAbilityModifier(abilities.dex);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};
  const passivePerception = calculatePassivePerception(abilities, proficiencyBonus, skillStates, skillMasteryStates);
  const currentHp = normalizeNumber(hp.current);
  const maxHp = normalizeNumber(hp.max);
  const hpPercent = maxHp ? Math.min(Math.max((Number(currentHp) / maxHp) * 100, 0), 100) : 0;
  const hpLabel = maxHp ? `${currentHp ?? '-'}/${maxHp}` : `${currentHp ?? '-'}`;
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
            </div>
          </div>
        </div>
        <div class="character-summary-actions">
          <div class="proficiency-chip">
            <span>Bonus competenza</span>
            <strong>${formatSigned(proficiencyBonus)}</strong>
          </div>
        </div>
      </div>
      <div class="stat-panel">     
        <div class="stat-grid stat-grid--compact stat-grid--abilities">
          ${abilityCards.map((ability) => `
            <div class="stat-card stat-card--${ability.key}">
              <span>${ability.label}</span>
              <strong>${formatAbility(ability.value)}</strong>
            </div>
          `).join('')}
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
            </div>
            <div class="hp-bar">
              <div class="hp-bar__fill" style="width: ${hpPercent}%;"></div>
            </div>
            <div class="hp-panel-hit-dice">
              <span>Dadi vita</span>
              <strong>${formatHitDice(hitDice)}</strong>
            </div>
          </div>
        </div>
        <div class="hp-panel-subgrid">
          <div class="stat-chip">
            <span>Velocità</span>
            <strong>${data.speed ?? '-'}</strong>
          </div>
          <div class="stat-chip">
            <span>Percezione passiva</span>
            <strong>${passivePerception ?? '-'}</strong>
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
      <details class="accordion">
        <summary>Descrizione e storia</summary>
        <div class="detail-card detail-card--text">
          <p>${data.description ? data.description : 'Aggiungi una descrizione del personaggio.'}</p>
        </div>
      </details>
    </div>
  `;
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
  const noteItems = parseProficiencyNotes(notes);
  const equipped = equipmentProficiencyList
    .filter((prof) => proficiencies[prof.key])
    .map((prof) => prof.label);

  return `
    <div class="detail-section">
      <div class="detail-card detail-card--text">
        <div>
          <strong>Equipaggiamento</strong>
          ${equipped.length
    ? `<div class="tag-row">${equipped.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Nessuna competenza equipaggiamento.</p>'}
        </div>
        <div>
          <strong>Strumenti e lingue</strong>
          ${noteItems.length
    ? `<div class="tag-row">${noteItems.map((label) => `<span class="chip">${label}</span>`).join('')}</div>`
    : '<p class="muted">Aggiungi strumenti o lingue nel profilo.</p>'}
        </div>
      </div>
    </div>
  `;
}

function buildHpShortcutFields(character, allowHitDice = true) {
  const wrapper = document.createElement('div');
  const amountField = buildInput({ label: 'Valore', name: 'amount', type: 'number', value: '1' });
  const amountInput = amountField.querySelector('input');
  if (amountInput) {
    amountInput.min = '1';
    amountInput.required = true;
  }
  wrapper.appendChild(amountField);

  if (!allowHitDice) {
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

function buildResourceList(resources, canManageResources, { showCharges = true } = {}) {
  return `
    <ul class="resource-list resource-list--compact">
      ${resources.map((res) => `
        <li class="resource-card" data-resource-card="${res.id}">
          <div class="resource-card-header">
            <div class="resource-info">
              ${res.image_url
    ? `<img class="resource-avatar" src="${res.image_url}" alt="Foto di ${res.name}" />`
    : `<div class="resource-avatar resource-avatar--placeholder" aria-hidden="true">${res.name?.trim().charAt(0).toUpperCase() || 'R'}</div>`}
              <div class="resource-meta">
                <div class="resource-title-row">
                  <strong>${res.name}</strong>
                </div>
                <div class="resource-submeta">
                  ${showCharges && Number(res.max_uses)
    ? `
                      <div class="resource-charge-row">
                        ${buildResourceCharges(res)}
                      </div>
                    `
    : ''}
                </div>
              </div>
            </div>
            <div class="resource-card-actions">
              <div class="resource-actions resource-actions--top">
                ${canManageResources ? `<button class="resource-action-button resource-icon-button" data-edit-resource="${res.id}" aria-label="Modifica risorsa">✏️</button>` : ''}
              </div>
            </div>
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
  const passiveResources = resources.filter((resource) => resource.reset_on === 'none');
  const activeResources = resources.filter((resource) => resource.reset_on !== 'none');
  const activeSection = activeResources.length
    ? buildResourceList(activeResources, canManageResources)
    : '<p class="muted">Nessuna risorsa attiva.</p>';
  const passiveSection = passiveResources.length
    ? `
      <div class="resource-section">
        <h4>Abilità Passive</h4>
        ${buildResourceList(passiveResources, canManageResources, { showCharges: false })}
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
  const charges = Array.from({ length: maxUses }, (_, index) => {
    const isUsed = index < used;
    const classes = [
      'charge-indicator',
      style === 'long' ? 'charge-indicator--long' : 'charge-indicator--short',
      isUsed ? 'charge-indicator--used' : ''
    ].filter(Boolean).join(' ');
    return `<span class="${classes}" aria-hidden="true"></span>`;
  }).join('');
  return `<div class="resource-charges" aria-label="Cariche risorsa">${charges}</div>`;
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
  const passiveField = document.createElement('label');
  passiveField.className = 'checkbox';
  passiveField.innerHTML = '<input type="checkbox" name="is_passive" /> <span>Passiva (senza cariche)</span>';
  form.appendChild(passiveField);
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
    { value: 'long_rest', label: 'Riposo lungo' },
    { value: 'none', label: 'Nessuna ricarica' }
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
    passiveInput.checked = Number(resource?.max_uses) === 0;
  }
  const syncPassiveState = () => {
    const isPassive = passiveInput?.checked;
    if (isPassive) {
      if (maxUsesInput) maxUsesInput.value = '0';
      if (usedInput) usedInput.value = '0';
      if (recoveryShortInput) recoveryShortInput.value = '0';
      if (recoveryLongInput) recoveryLongInput.value = '0';
      resetSelect.value = 'none';
    }
    if (maxUsesInput) maxUsesInput.disabled = isPassive;
    if (usedInput) usedInput.disabled = isPassive;
    if (recoveryShortInput) recoveryShortInput.disabled = isPassive;
    if (recoveryLongInput) recoveryLongInput.disabled = isPassive;
    resetSelect.disabled = isPassive;
  };
  passiveInput?.addEventListener('change', syncPassiveState);
  syncPassiveState();

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
    const payload = {
      user_id: currentUser?.id ?? character.user_id,
      character_id: character.id,
      name,
      image_url: formData.get('image_url')?.trim() || null,
      max_uses: maxUses,
      used,
      reset_on: formData.get('reset_on'),
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
  return `${used} / ${max}${die}`;
}

function calculateArmorClass(data, abilities, items) {
  const equippedItems = (items || []).filter((item) => item.equipable);
  const dexMod = getAbilityModifier(abilities.dex) ?? 0;
  const acAbilityModifiers = data.ac_ability_modifiers || {};
  const extraMods = Object.keys(acAbilityModifiers)
    .filter((ability) => acAbilityModifiers[ability])
    .reduce((total, ability) => total + (getAbilityModifier(abilities[ability]) ?? 0), 0);
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
  return base + shieldBonus;
}

function formatResourceRecovery(resource) {
  const maxUses = Number(resource.max_uses) || 0;
  if (maxUses === 0) return 'Passiva';
  const shortRecovery = Number(resource.recovery_short);
  const longRecovery = Number(resource.recovery_long);
  const hasShort = !Number.isNaN(shortRecovery) && shortRecovery > 0;
  const hasLong = !Number.isNaN(longRecovery) && longRecovery > 0;
  if (resource.reset_on === 'none' && !hasShort && !hasLong) {
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
