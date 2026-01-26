import { db } from './dexie.js';
import { getState, getStoredActiveCharacterId, setActiveCharacter, setState, updateCache } from '../../app/state.js';

export async function loadCachedData() {
  const { user } = getState();
  if (!user) return;
  const characters = await db.characters.where('user_id').equals(user.id).toArray();
  if (characters.length) {
    setState({ characters });
  }
  const storedActiveId = getStoredActiveCharacterId(user.id);
  const activeCharacterId = (storedActiveId && characters.some((char) => char.id === storedActiveId))
    ? storedActiveId
    : characters[0]?.id ?? null;
  if (activeCharacterId) {
    setActiveCharacter(activeCharacterId);
    const [items, resources, journal, wallet, tags] = await Promise.all([
      db.items.where('character_id').equals(activeCharacterId).toArray(),
      db.resources.where('character_id').equals(activeCharacterId).toArray(),
      db.journal.where('character_id').equals(activeCharacterId).toArray(),
      db.wallet.where('character_id').equals(activeCharacterId).first(),
      db.tags.where('user_id').equals(user.id).toArray()
    ]);
    updateCache('items', items);
    updateCache('resources', resources);
    updateCache('journal', journal);
    updateCache('wallet', wallet ?? null);
    updateCache('tags', tags);
  }
}

export async function cacheSnapshot({ characters, items, resources, wallet, journal, tags, entryTags }) {
  if (characters) {
    await db.characters.bulkPut(characters);
  }
  if (items) {
    await db.items.bulkPut(items);
  }
  if (resources) {
    await db.resources.bulkPut(resources);
  }
  if (wallet) {
    await db.wallet.put(wallet);
  }
  if (journal) {
    await db.journal.bulkPut(journal);
  }
  if (tags) {
    await db.tags.bulkPut(tags);
  }
  if (entryTags) {
    await db.entryTags.bulkPut(entryTags);
  }
}
