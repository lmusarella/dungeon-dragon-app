import { createCharacter, updateCharacter } from '../characterApi.js';
import { getState, setActiveCharacter, setState } from '../../../app/state.js';
import { cacheSnapshot } from '../../../lib/offline/cache.js';
import {
  buildInput,
  buildSelect,
  buildTextarea,
  createToast,
  openFormModal
} from '../../../ui/components.js';
import {
  abilityShortLabel,
  equipmentProficiencyList,
  savingThrowList,
  skillList
} from './constants.js';
import { getAbilityModifier, normalizeNumber, sortSpellsByLevel, getSpellTypeLabel } from './utils.js';

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

  const steps = [
    {
      title: 'Identità e background',
      content: buildEditGroup('Identità e background', [mainSection])
    },
    {
      title: 'Statistiche e difese',
      content: buildEditGroup('Statistiche e difese', [statsSection, acSection])
    },
    {
      title: 'Caratteristiche e competenze',
      content: buildEditGroup('Caratteristiche e competenze', [
        abilitySection,
        skillSection,
        savingSection,
        proficiencySection
      ])
    },
    {
      title: 'Combattimento e magia',
      content: buildEditGroup('Combattimento e magia', [combatSection])
    },
    {
      title: 'Note e dettagli',
      content: buildEditGroup('Note e dettagli', [
        proficiencyNotesSection,
        languageNotesSection,
        talentNotesSection
      ])
    }
  ];

  const stepper = document.createElement('div');
  stepper.className = 'character-edit-stepper';
  const stepperNav = document.createElement('ol');
  stepperNav.className = 'character-edit-stepper-nav';
  const stepperContent = document.createElement('div');
  stepperContent.className = 'character-edit-stepper-content';
  const stepperActions = document.createElement('div');
  stepperActions.className = 'character-edit-stepper-actions';
  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'secondary';
  backButton.textContent = 'Indietro';
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'primary';
  nextButton.textContent = 'Avanti';
  stepperActions.append(backButton, nextButton);

  const stepButtons = [];
  const stepPanels = [];
  steps.forEach((step, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-edit-stepper-button';
    button.innerHTML = `<span class="step-index">${index + 1}</span><span>${step.title}</span>`;
    item.appendChild(button);
    stepperNav.appendChild(item);
    stepButtons.push(button);

    const panel = document.createElement('div');
    panel.className = 'character-edit-step';
    panel.dataset.step = String(index);
    panel.appendChild(step.content);
    stepperContent.appendChild(panel);
    stepPanels.push(panel);
  });

  const getStepFields = (panel) => Array.from(panel.querySelectorAll('input, select, textarea'));
  const isStepComplete = (panel) => {
    const fields = getStepFields(panel);
    if (!fields.length) return true;
    return fields
      .filter((field) => field.required)
      .every((field) => field.checkValidity());
  };

  let activeStepIndex = 0;
  const updateStepperState = () => {
    const completion = stepPanels.map((panel) => isStepComplete(panel));
    const firstIncomplete = completion.findIndex((done) => !done);
    const maxAllowed = firstIncomplete === -1 ? stepPanels.length - 1 : firstIncomplete;
    stepPanels.forEach((panel, index) => {
      panel.classList.toggle('is-active', index === activeStepIndex);
    });
    stepButtons.forEach((button, index) => {
      button.classList.toggle('is-active', index === activeStepIndex);
      button.classList.toggle('is-complete', completion[index]);
      button.disabled = index > maxAllowed;
    });
    backButton.disabled = activeStepIndex === 0;
    nextButton.disabled = !completion[activeStepIndex] || activeStepIndex >= stepPanels.length - 1;
  };

  const setActiveStep = (index) => {
    activeStepIndex = Math.min(Math.max(index, 0), stepPanels.length - 1);
    updateStepperState();
    stepPanels[activeStepIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  stepButtons.forEach((button, index) => {
    button.addEventListener('click', () => setActiveStep(index));
  });
  backButton.addEventListener('click', () => setActiveStep(activeStepIndex - 1));
  nextButton.addEventListener('click', () => setActiveStep(activeStepIndex + 1));
  form.addEventListener('input', updateStepperState);
  form.addEventListener('change', updateStepperState);

  stepper.append(stepperNav, stepperContent, stepperActions);
  form.appendChild(stepper);
  updateStepperState();

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
