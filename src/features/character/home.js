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
import { getState, setActiveCharacter, setState, updateCache } from '../../app/state.js';
import {
  buildDrawerLayout,
  buildInput,
  buildSelect,
  buildTextarea,
  closeDrawer,
  createToast,
  openConfirmModal,
  openDrawer,
  openFormModal
} from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';

export async function renderHome(container) {
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
  if (!offline && activeCharacter) {
    try {
      resources = await fetchResources(activeCharacter.id);
      updateCache('resources', resources);
      await cacheSnapshot({ resources });
    } catch (error) {
      createToast('Errore caricamento risorse', 'error');
    }
  }

  container.innerHTML = `
    <div class="home-layout">
      <section class="card home-card">
        <header class="card-header">
          <div>
            <p class="eyebrow">Scheda</p>
            <h2>Personaggio</h2>
          </div>
          <div class="actions">
            ${characters.length > 1 ? '<select data-character-select></select>' : ''}
            ${activeCharacter && canEditCharacter ? '<button data-edit-character>Modifica</button>' : ''}
          </div>
        </header>
        ${activeCharacter ? buildCharacterSummary(activeCharacter, canEditCharacter) : buildEmptyState(canCreateCharacter, offline)}
      </section>
      <section class="card home-card">
        <header class="card-header">
          <div>
            <p class="eyebrow">Focus</p>
            <h3>Risorse e abilità</h3>
          </div>
          ${activeCharacter && canManageResources ? '<button class="primary" data-add-resource>Nuova risorsa</button>' : ''}
        </header>
        ${activeCharacter
    ? (resources.length ? buildResourceList(resources, canManageResources) : '<p>Nessuna risorsa.</p>')
    : '<p>Nessun personaggio selezionato.</p>'}
        ${activeCharacter && !canManageResources ? '<p class="muted">Connettiti per aggiungere nuove risorse.</p>' : ''}
        ${activeCharacter ? `
          <div class="button-row">
            <button class="ghost-button" data-rest="short_rest">Riposo breve</button>
            <button class="ghost-button" data-rest="long_rest">Riposo lungo</button>
          </div>
        ` : ''}
      </section>
    </div>
  `;

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

  container.querySelectorAll('[data-use-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.useResource);
      if (!resource) return;
      const maxUses = Number(resource.max_uses) || 0;
      if (maxUses && resource.used >= maxUses) return;
      try {
        await updateResource(resource.id, { used: Math.min(resource.used + 1, maxUses) });
        createToast('Risorsa usata');
        renderHome(container);
      } catch (error) {
        createToast('Errore utilizzo risorsa', 'error');
      }
    }));

  container.querySelectorAll('[data-recover-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.recoverResource);
      if (!resource) return;
      try {
        await updateResource(resource.id, { used: Math.max(resource.used - 1, 0) });
        createToast('Utilizzo recuperato');
        renderHome(container);
      } catch (error) {
        createToast('Errore recupero risorsa', 'error');
      }
    }));

  container.querySelectorAll('[data-edit-resource]')
    .forEach((button) => button.addEventListener('click', () => {
      const resource = resources.find((entry) => entry.id === button.dataset.editResource);
      if (!resource) return;
      openResourceDrawer(activeCharacter, () => renderHome(container), resource);
    }));

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

  container.querySelectorAll('[data-rest]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resetOn = button.dataset.rest;
      if (!activeCharacter) return;
      const shouldRest = await openConfirmModal({ message: 'Confermi il riposo?' });
      if (!shouldRest) return;
      try {
        await updateResourcesReset(activeCharacter.id, resetOn);
        createToast('Risorse aggiornate');
        const refreshed = await fetchResources(activeCharacter.id);
        updateCache('resources', refreshed);
        await cacheSnapshot({ resources: refreshed });
        renderHome(container);
      } catch (error) {
        createToast('Errore aggiornamento risorse', 'error');
      }
    }));

  container.querySelectorAll('[data-hp-action]')
    .forEach((button) => button.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const action = button.dataset.hpAction;
      const title = action === 'heal' ? 'Cura PF' : 'Infliggi danno';
      const submitLabel = action === 'heal' ? 'Cura' : 'Danno';
      const formData = await openFormModal({
        title,
        submitLabel,
        content: buildHpShortcutFields()
      });
      if (!formData) return;
      const amount = Number(formData.get('amount'));
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
      await saveCharacterData(activeCharacter, {
        ...activeCharacter.data,
        hp: {
          ...activeCharacter.data?.hp,
          current: adjusted
        }
      }, action === 'heal' ? 'PF curati' : 'Danno ricevuto', container);
    }));

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

async function openCharacterDrawer(user, onSave, character = null) {
  if (!user) return;
  const characterData = character?.data || {};
  const hp = characterData.hp || {};
  const hitDice = characterData.hit_dice || {};
  const abilities = characterData.abilities || {};
  const skillStates = characterData.skills || {};
  const skillMasteryStates = characterData.skill_mastery || {};
  const savingStates = characterData.saving_throws || {};
  const form = document.createElement('div');
  form.className = 'character-edit-form';

  const mainSection = document.createElement('div');
  mainSection.className = 'character-edit-section';
  mainSection.innerHTML = '<h4>Dati principali</h4>';
  const nameField = buildInput({ label: 'Nome', name: 'name', placeholder: 'Es. Aria', value: character?.name ?? '' });
  nameField.querySelector('input').required = true;
  mainSection.appendChild(nameField);
  mainSection.appendChild(buildInput({ label: 'Sistema', name: 'system', placeholder: 'Es. D&D 5e', value: character?.system ?? '' }));
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

  form.appendChild(mainSection);
  form.appendChild(statsSection);
  form.appendChild(abilitySection);
  form.appendChild(skillSection);
  form.appendChild(savingSection);

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
    speed: toNumberOrNull(formData.get('speed')),
    proficiency_bonus: toNumberOrNull(formData.get('proficiency_bonus')),
    initiative: toNumberOrNull(formData.get('initiative')),
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
    saving_throws: nextSaving
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

function buildCharacterSummary(character, canEditCharacter) {
  const data = character.data || {};
  const hp = data.hp || {};
  const hitDice = data.hit_dice || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const initiativeBonus = data.initiative ?? getAbilityModifier(abilities.dex);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};
  const savingStates = data.saving_throws || {};
  const passivePerception = calculatePassivePerception(abilities, proficiencyBonus, skillStates, skillMasteryStates);
  const abilityCards = [
    { label: 'Forza', value: abilities.str },
    { label: 'Destrezza', value: abilities.dex },
    { label: 'Costituzione', value: abilities.con },
    { label: 'Intelligenza', value: abilities.int },
    { label: 'Saggezza', value: abilities.wis },
    { label: 'Carisma', value: abilities.cha }
  ];
  return `
    <div class="character-summary">
      <div class="character-hero">
        ${data.avatar_url ? `<img class="character-avatar" src="${data.avatar_url}" alt="Ritratto di ${character.name}" />` : ''}
        <div>
          <h3>${character.name}</h3>
          <p class="muted">${character.system ?? 'Sistema'} </p>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <span>HP</span>
          <strong>${hp.current ?? '-'} / ${hp.max ?? '-'}</strong>
        </div>
        <div class="stat-card">
          <span>CA</span>
          <strong>${data.ac ?? '-'}</strong>
        </div>
        <div class="stat-card">
          <span>Velocità</span>
          <strong>${data.speed ?? '-'}</strong>
        </div>
        <div class="stat-card">
          <span>Bonus competenza</span>
          <strong>${formatSigned(proficiencyBonus)}</strong>
        </div>
        <div class="stat-card">
          <span>Iniziativa</span>
          <strong>${formatSigned(normalizeNumber(initiativeBonus))}</strong>
        </div>
        <div class="stat-card">
          <span>Percezione passiva</span>
          <strong>${passivePerception ?? '-'}</strong>
        </div>
      </div>
      <div class="detail-section">
        <h4>Descrizione</h4>
        <div class="detail-card detail-card--text">
          <p>${data.description ? data.description : 'Aggiungi una descrizione del personaggio.'}</p>
        </div>
      </div>
      <div class="hp-shortcuts">
        <strong>PF rapidi</strong>
        <div class="button-row">
          <button class="ghost-button" data-hp-action="heal" ${canEditCharacter ? '' : 'disabled'}>Cura</button>
          <button class="ghost-button" data-hp-action="damage" ${canEditCharacter ? '' : 'disabled'}>Danno</button>
        </div>
      </div>
      <div class="detail-section">
        <h4>Dadi vita</h4>
        <div class="detail-grid">
          <div class="detail-card">
            <span>${hitDice.die ?? 'Dado'}</span>
            <strong>${formatHitDice(hitDice)}</strong>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <h4>Bonus competenza</h4>
        <div class="detail-grid">
          <div class="detail-card">
            <span>Valore base</span>
            <strong>${formatSigned(proficiencyBonus)}</strong>
          </div>
          <div class="detail-card">
            <span>Maestria</span>
            <strong>${proficiencyBonus !== null ? formatSigned(proficiencyBonus * 2) : '-'}</strong>
          </div>
        </div>
      </div>
      <div>
        <h4>Statistiche</h4>
        <div class="stat-grid">
          ${abilityCards.map((ability) => `
            <div class="stat-card">
              <span>${ability.label}</span>
              <strong>${formatAbility(ability.value)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="detail-section">
        <h4>Abilità</h4>
        <div class="detail-grid detail-grid--compact">
          ${skillList.map((skill) => {
    const proficient = Boolean(skillStates[skill.key]);
    const mastery = Boolean(skillMasteryStates[skill.key]);
    const total = calculateSkillModifier(abilities[skill.ability], proficiencyBonus, proficient ? (mastery ? 2 : 1) : 0);
    return `
            <div class="modifier-card">
              <div>
                <div class="modifier-title">
                  <strong>${skill.label}</strong>
                  <span class="modifier-ability">${abilityShortLabel[skill.ability]}</span>
                </div>
                <div class="modifier-tags">
                  ${proficient ? '<span class="modifier-tag modifier-tag--pro">Competenza</span>' : '<span class="modifier-tag modifier-tag--muted">Base</span>'}
                  ${mastery ? '<span class="modifier-tag modifier-tag--mastery">Maestria</span>' : ''}
                </div>
              </div>
              <div class="modifier-value">${formatSigned(total)}</div>
            </div>
          `;
  }).join('')}
        </div>
      </div>
      <div class="detail-section">
        <h4>Tiri salvezza</h4>
        <div class="detail-grid detail-grid--compact">
          ${savingThrowList.map((save) => {
    const proficient = Boolean(savingStates[save.key]);
    const total = calculateSkillModifier(abilities[save.key], proficiencyBonus, proficient ? 1 : 0);
    return `
            <div class="modifier-card">
              <div>
                <div class="modifier-title">
                  <strong>${save.label}</strong>
                </div>
                <div class="modifier-tags">
                  ${proficient ? '<span class="modifier-tag modifier-tag--pro">Competenza</span>' : '<span class="modifier-tag modifier-tag--muted">Base</span>'}
                </div>
              </div>
              <div class="modifier-value">${formatSigned(total)}</div>
            </div>
          `;
  }).join('')}
        </div>
      </div>
    </div>
  `;
}

function buildHpShortcutFields() {
  return `
    <label class="field">
      <span>Valore</span>
      <input name="amount" type="number" min="1" value="1" required />
    </label>
  `;
}

function buildResourceList(resources, canManageResources) {
  return `
    <ul class="resource-list">
      ${resources.map((res) => `
        <li>
          <div class="resource-info">
            ${res.image_url ? `<img class="resource-avatar" src="${res.image_url}" alt="Foto di ${res.name}" />` : ''}
            <div>
              <strong>${res.name}</strong>
              <p class="muted">${res.reset_on}</p>
            </div>
          </div>
          <div class="actions">
            <span>${res.used}/${res.max_uses}</span>
            ${canManageResources ? buildResourceActions(res) : ''}
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

function buildResourceActions(resource) {
  const maxUses = Number(resource.max_uses) || 0;
  const used = Number(resource.used) || 0;
  const canUse = maxUses === 0 ? false : used < maxUses;
  const canRecover = used > 0;
  return `
    <button data-use-resource="${resource.id}" ${canUse ? '' : 'disabled'}>Usa</button>
    <button data-recover-resource="${resource.id}" ${canRecover ? '' : 'disabled'}>Recupera</button>
    <button data-edit-resource="${resource.id}">Modifica</button>
    <button data-delete-resource="${resource.id}">Elimina</button>
  `;
}

function openResourceDrawer(character, onSave, resource = null) {
  if (!character) return;
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome risorsa', name: 'name', placeholder: 'Es. Ispirazione', value: resource?.name ?? '' }));
  form.appendChild(buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../risorsa.png',
    value: resource?.image_url ?? ''
  }));
  form.appendChild(buildInput({ label: 'Utilizzi massimi', name: 'max_uses', type: 'number', value: resource?.max_uses ?? 1 }));
  form.appendChild(buildInput({ label: 'Utilizzi già spesi', name: 'used', type: 'number', value: resource?.used ?? 0 }));

  const resetField = document.createElement('label');
  resetField.className = 'field';
  resetField.innerHTML = '<span>Reset</span>';
  const resetSelect = buildSelect([
    { value: 'short_rest', label: 'Riposo breve' },
    { value: 'long_rest', label: 'Riposo lungo' },
    { value: 'none', label: 'Nessun reset' }
  ], resource?.reset_on ?? 'long_rest');
  resetSelect.name = 'reset_on';
  resetField.appendChild(resetSelect);
  form.appendChild(resetField);

  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.type = 'submit';
  submit.textContent = resource ? 'Salva' : 'Crea';
  form.appendChild(submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get('name')?.trim();
    if (!name) {
      createToast('Inserisci un nome per la risorsa', 'error');
      return;
    }
    const payload = {
      user_id: character.user_id,
      character_id: character.id,
      name,
      image_url: formData.get('image_url')?.trim() || null,
      max_uses: Number(formData.get('max_uses')) || 0,
      used: Number(formData.get('used')) || 0,
      reset_on: formData.get('reset_on')
    };

    try {
      if (resource) {
        await updateResource(resource.id, payload);
        createToast('Risorsa aggiornata');
      } else {
        await createResource(payload);
        createToast('Risorsa creata');
      }
      closeDrawer();
      onSave();
    } catch (error) {
      createToast('Errore salvataggio risorsa', 'error');
    }
  });

  openDrawer(buildDrawerLayout(resource ? 'Modifica risorsa' : 'Nuova risorsa', form));
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
