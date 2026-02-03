import { createItem, updateItem } from './inventoryApi.js';
import { buildInput, buildSelect, buildTextarea, createToast, openFormModal } from '../../ui/components.js';
import { armorTypes, bodyParts, itemCategories, weaponAbilities, weaponRanges, weaponTypes } from './constants.js';
import { getEquipSlots, getWeightUnit, hasProficiencyForItem } from './utils.js';

export async function openItemModal(character, item, items, onSave) {
  const fields = document.createElement('div');
  fields.className = 'drawer-form modal-form-grid';
  const buildRow = (elements, variant = 'balanced') => {
    const row = document.createElement('div');
    row.className = `modal-form-row modal-form-row--${variant}`;
    elements.filter(Boolean).forEach((element) => row.appendChild(element));
    return row;
  };
  const nameField = buildInput({ label: 'Nome', name: 'name', value: item?.name ?? '' });
  const imageField = buildInput({
    label: 'Foto (URL)',
    name: 'image_url',
    placeholder: 'https://.../oggetto.png',
    value: item?.image_url ?? ''
  });
  fields.appendChild(buildRow([nameField, imageField], 'balanced'));
  const qtyField = buildInput({ label: 'Quantità', name: 'qty', type: 'number', value: item?.qty ?? 1 });
  const weightField = buildInput({ label: 'Peso', name: 'weight', type: 'number', value: item?.weight ?? 0 });
  const weightInput = weightField.querySelector('input');
  if (weightInput) {
    const unit = getWeightUnit(character);
    weightInput.min = '0';
    weightInput.step = unit === 'kg' ? '0.1' : '1';
  }
  const volumeField = buildInput({ label: 'Volume', name: 'volume', type: 'number', value: item?.volume ?? 0 });
  const valueField = buildInput({ label: 'Valore (cp)', name: 'value_cp', type: 'number', value: item?.value_cp ?? 0 });
  fields.appendChild(buildRow([qtyField, weightField, volumeField, valueField], 'compact'));
  const categorySelect = buildSelect(
    [{ value: '', label: 'Seleziona' }, ...itemCategories],
    item?.category ?? ''
  );
  categorySelect.name = 'category';
  const categoryField = document.createElement('label');
  categoryField.className = 'field';
  categoryField.innerHTML = '<span>Categoria</span>';
  categoryField.appendChild(categorySelect);

  const containerOptions = [{ value: '', label: 'Nessuno' }].concat(
    items.filter((entry) => entry.category === 'container').map((entry) => ({
      value: entry.id,
      label: entry.name
    }))
  );
  const containerSelect = buildSelect(containerOptions, item?.container_item_id ?? '');
  containerSelect.name = 'container_item_id';
  const containerField = document.createElement('label');
  containerField.className = 'field';
  containerField.innerHTML = '<span>Contenitore</span>';
  containerField.appendChild(containerSelect);
  const maxVolumeField = buildInput({
    label: 'Volume massimo contenitore',
    name: 'max_volume',
    type: 'number',
    value: item?.max_volume ?? ''
  });
  const maxVolumeInput = maxVolumeField.querySelector('input');
  fields.appendChild(buildRow([categoryField, containerField, maxVolumeField], 'balanced'));

  const equipableWrapper = document.createElement('div');
  equipableWrapper.className = 'compact-field-grid';
  const equipableField = document.createElement('label');
  equipableField.className = 'checkbox';
  equipableField.innerHTML = '<input type="checkbox" name="equipable" /> <span>Equipaggiabile</span>';
  const equipableInput = equipableField.querySelector('input');
  const overlayableField = document.createElement('label');
  overlayableField.className = 'checkbox';
  overlayableField.innerHTML = '<input type="checkbox" name="sovrapponibile" /> <span>Sovrapponibile</span>';
  const overlayableInput = overlayableField.querySelector('input');
  const equipSlotsField = document.createElement('fieldset');
  equipSlotsField.className = 'equip-slot-field';
  equipSlotsField.innerHTML = '<legend>Punti del corpo</legend>';
  const equipSlotList = document.createElement('div');
  equipSlotList.className = 'equip-slot-list';
  const selectedSlots = getEquipSlots(item);
  const equipSlotInputs = bodyParts.map((part) => {
    const label = document.createElement('label');
    label.className = 'checkbox';
    label.innerHTML = `<input type="checkbox" name="equip_slots" value="${part.value}" /> <span>${part.label}</span>`;
    const input = label.querySelector('input');
    if (input && selectedSlots.includes(part.value)) {
      input.checked = true;
    }
    equipSlotList.appendChild(label);
    return input;
  });
  equipSlotsField.appendChild(equipSlotList);
  equipableWrapper.appendChild(equipableField);
  equipableWrapper.appendChild(overlayableField);
  const attunement = document.createElement('label');
  attunement.className = 'checkbox';
  attunement.innerHTML = '<input type="checkbox" name="attunement_active" /> <span>Sintonia attiva</span>';
  const attunementInput = attunement.querySelector('input');
  fields.appendChild(buildRow([equipableWrapper, attunement], 'balanced'));
  fields.appendChild(equipSlotsField);

  fields.appendChild(buildTextarea({ label: 'Note', name: 'notes', value: item?.notes ?? '' }));

  const proficiencySection = document.createElement('div');
  proficiencySection.className = 'drawer-form modal-form-grid';
  const weaponTypeField = document.createElement('label');
  weaponTypeField.className = 'field';
  weaponTypeField.innerHTML = '<span>Tipo arma</span>';
  const weaponTypeSelect = buildSelect(weaponTypes, item?.weapon_type ?? '');
  weaponTypeSelect.name = 'weapon_type';
  weaponTypeField.appendChild(weaponTypeSelect);
  const weaponRangeField = document.createElement('label');
  weaponRangeField.className = 'field';
  weaponRangeField.innerHTML = '<span>Proprietà arma</span>';
  const weaponRangeSelect = buildSelect(weaponRanges, item?.weapon_range ?? '');
  weaponRangeSelect.name = 'weapon_range';
  weaponRangeField.appendChild(weaponRangeSelect);
  const weaponAbilityField = document.createElement('label');
  weaponAbilityField.className = 'field';
  weaponAbilityField.innerHTML = '<span>Caratteristica tiro per colpire</span>';
  const weaponAbilitySelect = buildSelect(weaponAbilities, item?.attack_ability ?? '');
  weaponAbilitySelect.name = 'attack_ability';
  weaponAbilityField.appendChild(weaponAbilitySelect);
  const damageDieField = buildInput({
    label: 'Dado danno',
    name: 'damage_die',
    placeholder: 'Es. 1d8',
    value: item?.damage_die ?? ''
  });
  const attackModifierField = buildInput({
    label: 'Modificatore per colpire',
    name: 'attack_modifier',
    type: 'number',
    value: item?.attack_modifier ?? 0
  });
  const damageModifierField = buildInput({
    label: 'Modificatore danno',
    name: 'damage_modifier',
    type: 'number',
    value: item?.damage_modifier ?? 0
  });
  const thrownField = document.createElement('label');
  thrownField.className = 'checkbox';
  thrownField.innerHTML = '<input type="checkbox" name="is_thrown" /> <span>Proprietà lancio</span>';
  const thrownInput = thrownField.querySelector('input');
  const rangeGrid = document.createElement('div');
  rangeGrid.className = 'compact-field-grid';
  const meleeRangeField = buildInput({
    label: 'Portata arma (m)',
    name: 'melee_range',
    type: 'number',
    value: item?.melee_range ?? 1.5
  });
  const rangeNormalField = buildInput({
    label: 'Gittata normale',
    name: 'range_normal',
    type: 'number',
    value: item?.range_normal ?? ''
  });
  const rangeDisadvantageField = buildInput({
    label: 'Gittata svantaggio',
    name: 'range_disadvantage',
    type: 'number',
    value: item?.range_disadvantage ?? ''
  });
  rangeGrid.appendChild(meleeRangeField);
  rangeGrid.appendChild(rangeNormalField);
  rangeGrid.appendChild(rangeDisadvantageField);

  const armorTypeField = document.createElement('label');
  armorTypeField.className = 'field';
  armorTypeField.innerHTML = '<span>Tipo armatura</span>';
  const armorTypeSelect = buildSelect(armorTypes, item?.armor_type ?? '');
  armorTypeSelect.name = 'armor_type';
  armorTypeField.appendChild(armorTypeSelect);

  const shieldField = document.createElement('label');
  shieldField.className = 'checkbox';
  shieldField.innerHTML = '<input type="checkbox" name="is_shield" /> <span>Scudo</span>';
  const shieldInput = shieldField.querySelector('input');

  const armorClassField = buildInput({
    label: 'Classe armatura base',
    name: 'armor_class',
    type: 'number',
    value: item?.armor_class ?? ''
  });
  const armorClassInput = armorClassField.querySelector('input');
  const armorBonusField = buildInput({
    label: 'Bonus armatura',
    name: 'armor_bonus',
    type: 'number',
    value: item?.armor_bonus ?? 0
  });
  const armorBonusInput = armorBonusField.querySelector('input');
  const shieldBonusField = buildInput({
    label: 'Bonus scudo',
    name: 'shield_bonus',
    type: 'number',
    value: item?.shield_bonus ?? 2
  });
  const shieldBonusInput = shieldBonusField.querySelector('input');

  proficiencySection.appendChild(buildRow([weaponTypeField, weaponRangeField, weaponAbilityField], 'balanced'));
  proficiencySection.appendChild(buildRow([damageDieField, attackModifierField, damageModifierField], 'compact'));
  proficiencySection.appendChild(buildRow([thrownField], 'compact'));
  proficiencySection.appendChild(rangeGrid);
  proficiencySection.appendChild(buildRow([armorTypeField, shieldField, armorClassField], 'balanced'));
  proficiencySection.appendChild(buildRow([armorBonusField, shieldBonusField], 'compact'));
  fields.appendChild(proficiencySection);

  if (attunementInput) {
    attunementInput.checked = item?.attunement_active ?? false;
  }
  if (equipableInput) {
    equipableInput.checked = item?.equipable ?? false;
  }
  if (overlayableInput) {
    overlayableInput.checked = item?.sovrapponibile ?? false;
  }
  if (shieldInput) {
    shieldInput.checked = item?.is_shield ?? false;
  }
  if (thrownInput) {
    thrownInput.checked = item?.is_thrown ?? false;
  }
  const updateEquipmentFields = () => {
    const equipableEnabled = equipableInput?.checked ?? false;
    equipSlotInputs.forEach((input) => {
      if (!input) return;
      input.disabled = !equipableEnabled;
      if (!equipableEnabled) {
        input.checked = false;
      }
    });
    if (overlayableInput) {
      overlayableInput.disabled = !equipableEnabled;
      if (!equipableEnabled) {
        overlayableInput.checked = false;
      }
    }
    const isWeapon = categorySelect.value === 'weapon';
    const isArmor = categorySelect.value === 'armor';
    const isContainer = categorySelect.value === 'container';
    weaponTypeSelect.disabled = !isWeapon;
    weaponRangeSelect.disabled = !isWeapon;
    weaponAbilitySelect.disabled = !isWeapon;
    damageDieField.querySelector('input').disabled = !isWeapon;
    attackModifierField.querySelector('input').disabled = !isWeapon;
    damageModifierField.querySelector('input').disabled = !isWeapon;
    if (thrownInput) {
      thrownInput.disabled = !isWeapon;
    }
    const rangeInputs = rangeGrid.querySelectorAll('input');
    rangeInputs.forEach((input) => {
      input.disabled = !isWeapon;
      if (!isWeapon) {
        input.value = '';
      } else if (input.name === 'melee_range' && !input.value) {
        input.value = '1.5';
      }
    });
    armorTypeSelect.disabled = !isArmor;
    if (shieldInput) {
      shieldInput.disabled = !isArmor;
    }
    if (armorClassInput) {
      armorClassInput.disabled = !isArmor;
    }
    if (armorBonusInput) {
      armorBonusInput.disabled = !isArmor;
    }
    if (shieldBonusInput) {
      shieldBonusInput.disabled = !isArmor || !(shieldInput?.checked ?? false);
    }
    if (maxVolumeInput) {
      maxVolumeInput.disabled = !isContainer;
      if (!isContainer) {
        maxVolumeInput.value = '';
      }
    }
  };
  equipableInput?.addEventListener('change', updateEquipmentFields);
  categorySelect.addEventListener('change', updateEquipmentFields);
  shieldInput?.addEventListener('change', updateEquipmentFields);
  thrownInput?.addEventListener('change', updateEquipmentFields);
  updateEquipmentFields();

  const formData = await openFormModal({
    title: item ? 'Modifica oggetto' : 'Nuovo oggetto',
    submitLabel: item ? 'Salva' : 'Crea',
    content: fields,
    cardClass: ['modal-card--wide', 'modal-card--scrollable']
  });
  if (!formData) return;
  const equipableEnabled = formData.get('equipable') === 'on';
  const equipSlots = equipableEnabled ? formData.getAll('equip_slots') : [];
  const equipSlot = equipSlots[0] || null;
  const category = formData.get('category');
  if (equipSlots.length && !hasProficiencyForItem(character, formData)) {
    createToast('Non hai la competenza per equipaggiare questo oggetto', 'error');
    return;
  }
  const isOverlayable = formData.get('sovrapponibile') === 'on';
  if (equipSlots.length && !isOverlayable) {
    const conflicting = items.filter((entry) => entry.id !== item?.id)
      .filter((entry) => getEquipSlots(entry).some((slot) => equipSlots.includes(slot)));
    if (conflicting.length) {
      createToast('Uno o più slot selezionati sono già occupati', 'error');
      return;
    }
  }
  const payload = {
    user_id: character.user_id,
    character_id: character.id,
    name: formData.get('name'),
    image_url: formData.get('image_url')?.trim() || null,
    qty: Number(formData.get('qty')),
    weight: Number(formData.get('weight')),
    volume: Number(formData.get('volume')) || 0,
    value_cp: Number(formData.get('value_cp')),
    category,
    container_item_id: formData.get('container_item_id') || null,
    max_volume: formData.get('max_volume') === '' ? null : Number(formData.get('max_volume')),
    equipable: equipableEnabled,
    equip_slot: equipSlot,
    equip_slots: equipSlots,
    sovrapponibile: isOverlayable,
    attunement_active: formData.get('attunement_active') === 'on',
    notes: formData.get('notes'),
    weapon_type: formData.get('weapon_type') || null,
    weapon_range: formData.get('weapon_range') || null,
    attack_ability: formData.get('attack_ability') || null,
    damage_die: formData.get('damage_die')?.trim() || null,
    attack_modifier: Number(formData.get('attack_modifier')) || 0,
    damage_modifier: Number(formData.get('damage_modifier')) || 0,
    is_thrown: formData.get('is_thrown') === 'on',
    melee_range: formData.get('melee_range') === '' ? null : Number(formData.get('melee_range')),
    range_normal: Number(formData.get('range_normal')) || null,
    range_disadvantage: Number(formData.get('range_disadvantage')) || null,
    armor_type: formData.get('armor_type') || null,
    is_shield: formData.get('is_shield') === 'on',
    armor_class: Number(formData.get('armor_class')) || null,
    armor_bonus: Number(formData.get('armor_bonus')) || 0,
    shield_bonus: Number(formData.get('shield_bonus')) || 0
  };

  try {
    if (item) {
      await updateItem(item.id, payload);
      createToast('Oggetto aggiornato');
    } else {
      await createItem(payload);
      createToast('Oggetto creato');
    }
    onSave();
  } catch (error) {
    createToast('Errore salvataggio oggetto', 'error');
  }
}
