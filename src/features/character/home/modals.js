import { createResource, updateResource } from '../characterApi.js';
import { getState } from '../../../app/state.js';
import {
  buildInput,
  buildSelect,
  buildTextarea,
  createToast,
  openConfirmModal,
  openFormModal
} from '../../../ui/components.js';
import { consumeSpellSlot, saveCharacterData } from './data.js';
import { formatResourceRecovery, formatSigned, getSpellTypeLabel, sortSpellsByLevel } from './utils.js';

function getPrepStateLabel(state) {
  switch (state) {
    case 'prepared':
      return 'Preparato';
    case 'always':
      return 'Sempre preparato';
    default:
      return 'Conosciuto';
  }
}

export function openBackgroundModal(character) {
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

export function openResourceDetail(resource, { onUse, onReset } = {}) {
  const detail = document.createElement('div');
  detail.className = 'resource-detail';
  const maxUses = Number(resource.max_uses) || 0;
  const isExhausted = maxUses && resource.used >= maxUses;
  const isActive = resource.reset_on !== null && resource.reset_on !== 'none';
  const hasAction = Boolean(maxUses && (isExhausted ? onReset : onUse));
  const submitLabel = maxUses
    ? isExhausted
      ? 'Ripristina'
      : 'Usa'
    : 'Chiudi';
  const usageLabel = maxUses ? `${resource.used}/${resource.max_uses}` : 'Passiva';
  detail.innerHTML = `
    <div class="detail-card detail-card--text">
      <h4>${resource.name}</h4>
      ${resource.description ? `<p>${resource.description}</p>` : ''}
      ${isActive ? '' : `
        ${resource.image_url ? `<img class="resource-detail-image" src="${resource.image_url}" alt="Foto di ${resource.name}" />` : ''}
        ${resource.cast_time ? `<p class="resource-chip">${resource.cast_time}</p>` : ''}
        <p class="muted">${formatResourceRecovery(resource)}</p>
        <p>Cariche: ${usageLabel}</p>
      `}
    </div>
  `;
  openFormModal({
    title: 'Dettaglio risorsa',
    submitLabel,
    cancelLabel: hasAction ? 'Chiudi' : null,
    content: detail
  }).then(async (formData) => {
    if (!formData || !maxUses) return;
    if (isExhausted && onReset) {
      await onReset();
      return;
    }
    if (!isExhausted && onUse) {
      await onUse();
    }
  });
}

export function openSpellListModal(character, onRender) {
  if (!character) return;
  const data = character.data || {};
  const spells = Array.isArray(data.spells) ? sortSpellsByLevel(data.spells) : [];
  const canPrepare = Boolean(data.spellcasting?.can_prepare);
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
    const prepState = canPrepare ? spell.prep_state || 'known' : null;
    return `
              <div class="spell-list-modal__item">
                <div class="spell-list-modal__item-info">
                  <div class="spell-list-modal__item-title">
                    <strong>${spell.name}</strong>
                    <span class="chip chip--small">${typeLabel}</span>
                    ${prepState ? `<span class="chip chip--small">${getPrepStateLabel(prepState)}</span>` : ''}
                  </div>
                  <div class="spell-list-modal__item-meta">
                    ${attackLabel ? `<span>${attackLabel}</span>` : ''}
                    ${damageText ? `<span>Danni ${damageText}</span>` : ''}
                  </div>
                </div>
                <div class="spell-list-modal__item-actions">
                  <button class="icon-button" type="button" data-spell-edit="${spell.id}" aria-label="Modifica incantesimo" title="Modifica">
                    <span aria-hidden="true">✏️</span>
                  </button>
                  <button class="icon-button icon-button--danger" type="button" data-spell-delete="${spell.id}" aria-label="Elimina incantesimo" title="Elimina">
                    <span aria-hidden="true">🗑️</span>
                  </button>
                  ${level > 0
    ? `<button class="resource-cta-button resource-cta-button--label" type="button" data-spell-cast="${spell.id}">Lancia</button>`
    : ''}
                </div>
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
      const consumed = await consumeSpellSlot(character, level, onRender);
      if (consumed) {
        closeModal();
      }
    }));

  content.querySelectorAll('[data-spell-edit]')
    .forEach((button) => button.addEventListener('click', () => {
      const spell = spells.find((entry) => entry.id === button.dataset.spellEdit);
      if (!spell) return;
      closeModal();
      setTimeout(() => {
        openSpellDrawer(character, () => onRender?.(), spell);
      }, 0);
    }));

  content.querySelectorAll('[data-spell-delete]')
    .forEach((button) => button.addEventListener('click', async () => {
      const spell = spells.find((entry) => entry.id === button.dataset.spellDelete);
      if (!spell) return;
      const shouldDelete = await openConfirmModal({ message: `Eliminare l'incantesimo ${spell.name}?` });
      if (!shouldDelete) return;
      const nextSpells = spells.filter((entry) => entry.id !== spell.id);
      const nextData = {
        ...character.data,
        spells: nextSpells
      };
      await saveCharacterData(character, nextData, 'Incantesimo eliminato', () => onRender?.());
      closeModal();
    }));
}

export function openSpellDrawer(character, onSave, spell = null) {
  if (!character) return;
  const canPrepare = Boolean(character.data?.is_spellcaster);
  const form = document.createElement('div');
  form.className = 'drawer-form modal-form-grid spell-form';
  const buildRow = (elements, variant = 'balanced') => {
    const row = document.createElement('div');
    row.className = `modal-form-row modal-form-row--${variant}`;
    elements.filter(Boolean).forEach((element) => row.appendChild(element));
    return row;
  };
  const spellKindField = document.createElement('label');
  spellKindField.className = 'field';
  spellKindField.innerHTML = '<span>Tipo incantesimo</span>';
  const initialKind = spell?.kind ?? (Number(spell?.level) === 0 ? 'cantrip' : 'spell');
  const spellKindSelect = buildSelect([
    { value: 'cantrip', label: 'Trucchetto' },
    { value: 'spell', label: 'Incantesimo' }
  ], initialKind);
  spellKindSelect.name = 'spell_kind';
  spellKindField.appendChild(spellKindSelect);
  const nameField = buildInput({
    label: 'Nome incantesimo',
    name: 'spell_name',
    placeholder: 'Es. Palla di fuoco',
    value: spell?.name ?? ''
  });
  const nameInput = nameField.querySelector('input');
  if (nameInput) {
    nameInput.required = true;
  }
  const levelField = buildInput({
    label: 'Livello incantesimo',
    name: 'spell_level',
    type: 'number',
    value: spell?.level ?? 1
  });
  const levelInput = levelField.querySelector('input');
  if (levelInput) {
    levelInput.min = '1';
    levelInput.max = '9';
  }
  const prepStateField = canPrepare ? document.createElement('label') : null;
  let prepStateSelect = null;
  if (prepStateField) {
    prepStateField.className = 'field';
    prepStateField.innerHTML = '<span>Preparazione</span>';
    prepStateSelect = buildSelect([
      { value: 'known', label: 'Conosciuto' },
      { value: 'prepared', label: 'Preparato' },
      { value: 'always', label: 'Sempre preparato' }
    ], spell?.prep_state ?? 'known');
    prepStateSelect.name = 'spell_prep_state';
    prepStateField.appendChild(prepStateSelect);
  }
  form.appendChild(buildRow([spellKindField, levelField, prepStateField], 'compact'));
  form.appendChild(buildRow([nameField], 'balanced'));
  form.appendChild(buildRow([buildInput({
    label: 'Tempo di lancio',
    name: 'spell_cast_time',
    placeholder: 'Es. 1 azione',
    value: spell?.cast_time ?? ''
  }), buildInput({
    label: 'Durata',
    name: 'spell_duration',
    placeholder: 'Es. 1 minuto',
    value: spell?.duration ?? ''
  }), buildInput({
    label: 'Range',
    name: 'spell_range',
    placeholder: 'Es. 18 m',
    value: spell?.range ?? ''
  })], 'compact'));
  const concentrationField = document.createElement('label');
  concentrationField.className = 'checkbox';
  concentrationField.innerHTML = '<input type="checkbox" name="spell_concentration" /> <span>Concentrazione</span>';
  const attackRollField = document.createElement('label');
  attackRollField.className = 'checkbox';
  attackRollField.innerHTML = '<input type="checkbox" name="spell_attack_roll" /> <span>Tiro per colpire (targhet)</span>';
  form.appendChild(buildRow([concentrationField, attackRollField], 'balanced'));
  const damageDieField = buildInput({
    label: 'Dado danno',
    name: 'spell_damage_die',
    placeholder: 'Es. 1d10',
    value: spell?.damage_die ?? ''
  });
  const damageModifierField = buildInput({
    label: 'Modificatore danni',
    name: 'spell_damage_modifier',
    type: 'number',
    value: spell?.damage_modifier ?? ''
  });
  form.appendChild(buildRow([damageDieField, damageModifierField], 'compact'));
  form.appendChild(buildTextarea({
    label: 'Descrizione',
    name: 'spell_description',
    placeholder: 'Descrizione dell\'incantesimo...',
    value: spell?.description ?? ''
  }));

  const concentrationInput = form.querySelector('input[name="spell_concentration"]');
  if (concentrationInput) {
    concentrationInput.checked = Boolean(spell?.concentration);
  }
  const attackRollInput = form.querySelector('input[name="spell_attack_roll"]');
  if (attackRollInput) {
    attackRollInput.checked = Boolean(spell?.attack_roll);
  }

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
    title: spell ? 'Modifica incantesimo' : 'Nuovo incantesimo',
    submitLabel: spell ? 'Salva' : 'Aggiungi',
    content: form,
    cardClass: 'modal-card--form'
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
    const prepState = canPrepare ? formData.get('spell_prep_state') || 'known' : spell?.prep_state || 'known';
    const nextSpell = {
      id: spell?.id ?? `spell-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
      description: formData.get('spell_description')?.trim() || null,
      prep_state: prepState
    };
    const currentSpells = Array.isArray(character.data?.spells) ? character.data.spells : [];
    const nextSpells = spell
      ? currentSpells.map((entry) => (entry.id === spell.id ? nextSpell : entry))
      : [...currentSpells, nextSpell];
    const nextData = {
      ...character.data,
      spells: nextSpells
    };
    const message = spell ? 'Incantesimo aggiornato' : 'Incantesimo aggiunto';
    await saveCharacterData(character, nextData, message, onSave);
  });
}

export function openPreparedSpellsModal(character, onSave) {
  if (!character) return;
  const data = character.data || {};
  const spellcasting = data.spellcasting || {};
  if (!spellcasting.can_prepare) return;
  const spells = Array.isArray(data.spells) ? sortSpellsByLevel(data.spells) : [];
  const selectable = spells.filter((entry) => {
    const prepState = entry.prep_state || 'known';
    const level = Number(entry.level) || 0;
    return prepState !== 'always' && level > 0;
  });
  if (!selectable.length) {
    createToast('Nessun incantesimo preparabile.', 'info');
    return;
  }
  const prepared = selectable.filter((entry) => (entry.prep_state || 'known') === 'prepared');
  const known = selectable.filter((entry) => (entry.prep_state || 'known') !== 'prepared');
  const content = document.createElement('div');
  content.className = 'prepared-spells-modal';
  content.innerHTML = `
    <p class="muted">Seleziona gli incantesimi da preparare per oggi.</p>
    ${prepared.length ? `
      <div class="prepared-spells-modal__section">
        <h4>Preparati</h4>
        <div class="prepared-spells-modal__list">
          ${prepared.map((entry) => `
            <label class="checkbox">
              <input type="checkbox" name="prepared_${entry.id}" checked />
              <span>${entry.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${known.length ? `
      <div class="prepared-spells-modal__section">
        <h4>Disponibili</h4>
        <div class="prepared-spells-modal__list">
          ${known.map((entry) => `
            <label class="checkbox">
              <input type="checkbox" name="prepared_${entry.id}" />
              <span>${entry.name}</span>
            </label>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  openFormModal({
    title: 'Incantesimi preparati',
    submitLabel: 'Salva',
    cancelLabel: 'Annulla',
    content,
    cardClass: 'modal-card--form'
  }).then(async (formData) => {
    if (!formData) return;
    const nextSpells = spells.map((entry) => {
      const prepState = entry.prep_state || 'known';
      if (prepState === 'always') return entry;
      if (Number(entry.level) === 0) return entry;
      const isPrepared = formData.has(`prepared_${entry.id}`);
      return {
        ...entry,
        prep_state: isPrepared ? 'prepared' : 'known'
      };
    });
    const nextData = {
      ...character.data,
      spells: nextSpells
    };
    await saveCharacterData(character, nextData, 'Incantesimi preparati aggiornati', onSave);
  });
}

export function openAvatarModal(character) {
  const avatarUrl = character?.data?.avatar_url;
  if (!avatarUrl) return;
  const existing = document.querySelector('.avatar-preview');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'avatar-preview';
  overlay.tabIndex = 0;
  overlay.innerHTML = `
    <img class="avatar-preview__image" src="${avatarUrl}" alt="Ritratto di ${character.name}" />
  `;
  const close = () => {
    overlay.remove();
  };
  overlay.addEventListener('click', close);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
  document.body.appendChild(overlay);
  overlay.focus();
}

export function openResourceDrawer(character, onSave, resource = null) {
  if (!character) return;
  const form = document.createElement('div');
  form.className = 'drawer-form modal-form-grid';
  const buildRow = (elements, variant = 'balanced') => {
    const row = document.createElement('div');
    row.className = `modal-form-row modal-form-row--${variant}`;
    elements.filter(Boolean).forEach((element) => row.appendChild(element));
    return row;
  };
  const nameField = buildInput({ label: 'Nome abilità', name: 'name', placeholder: 'Es. Ispirazione', value: resource?.name ?? '' });
  const imageField = buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../risorsa.png',
    value: resource?.image_url ?? ''
  });
  form.appendChild(buildRow([nameField, imageField], 'balanced'));
  const passiveField = document.createElement('label');
  passiveField.className = 'checkbox';
  passiveField.innerHTML = '<input type="checkbox" name="is_passive" /> <span>Passiva (senza cariche)</span>';
  const castTimeField = document.createElement('label');
  castTimeField.className = 'field';
  castTimeField.innerHTML = '<span>Tipo di lancio</span>';
  const castTimeSelect = buildSelect([
    { value: 'Sempre attiva', label: 'Sempre attiva' },
    { value: 'Azione', label: 'Azione' },
    { value: 'Reazione', label: 'Reazione' },
    { value: 'Azione Bonus', label: 'Azione Bonus' },
    { value: 'Azione Gratuita', label: 'Azione Gratuita' }
  ], resource?.cast_time ?? 'Azione');
  castTimeSelect.name = 'cast_time';
  castTimeField.appendChild(castTimeSelect);
  const maxUsesField = buildInput({ label: 'Cariche massime', name: 'max_uses', type: 'number', value: resource?.max_uses ?? 1 });
  const usedField = buildInput({ label: 'Cariche consumate', name: 'used', type: 'number', value: resource?.used ?? 0 });
  form.appendChild(buildRow([castTimeField, maxUsesField, usedField], 'compact'));

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

  const resetField = document.createElement('label');
  resetField.className = 'field';
  resetField.innerHTML = '<span>Tipo ricarica</span>';
  const resetSelect = buildSelect([
    { value: 'short_rest', label: 'Riposo breve' },
    { value: 'long_rest', label: 'Riposo lungo' }
  ], resource?.reset_on ?? 'long_rest');
  resetSelect.name = 'reset_on';
  resetField.appendChild(resetSelect);
  form.appendChild(buildRow([passiveField, resetField], 'balanced'));
  form.appendChild(recoveryGrid);
  form.appendChild(buildTextarea({
    label: 'Descrizione',
    name: 'description',
    placeholder: 'Inserisci una descrizione...',
    value: resource?.description ?? ''
  }));

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

  openFormModal({
    title: resource ? 'Modifica abilità' : 'Nuova abilità',
    submitLabel: resource ? 'Salva' : 'Crea',
    content: form,
    cardClass: 'modal-card--form'
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
