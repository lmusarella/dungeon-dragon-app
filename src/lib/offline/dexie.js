import Dexie from 'dexie';

export const db = new Dexie('dungeonDragon');

db.version(1).stores({
  characters: 'id,user_id',
  items: 'id,character_id,user_id',
  resources: 'id,character_id,user_id',
  wallet: 'character_id,user_id',
  journal: 'id,character_id,user_id',
  tags: 'id,user_id',
  entryTags: '[entry_id+tag_id],entry_id,tag_id'
});
