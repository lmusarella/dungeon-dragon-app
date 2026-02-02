import { updateCharacter } from '../characterApi.js';
import { getState, setState } from '../../../app/state.js';
import { cacheSnapshot } from '../../../lib/offline/cache.js';
import { createToast } from '../../../ui/components.js';

export async function saveCharacterData(character, data, message, onRender) {
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
    if (onRender) {
      onRender();
    }
  } catch (error) {
    createToast('Errore aggiornamento personaggio', 'error');
  }
}

export async function consumeSpellSlot(character, level, onRender) {
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
  }, 'Slot incantesimo consumato', onRender);
  return true;
}
