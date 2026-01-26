import { supabase } from '../../lib/supabase.js';

export async function fetchEntries(characterId) {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('character_id', characterId)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTags(userId) {
  const { data, error } = await supabase
    .from('journal_tags')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchEntryTags(entryIds) {
  if (!entryIds.length) return [];
  const { data, error } = await supabase
    .from('journal_entry_tags')
    .select('*')
    .in('entry_id', entryIds);
  if (error) throw error;
  return data ?? [];
}

export async function createEntry(payload) {
  const { data, error } = await supabase
    .from('journal_entries')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEntry(id, payload) {
  const { data, error } = await supabase
    .from('journal_entries')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function createTag(payload) {
  const { data, error } = await supabase
    .from('journal_tags')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function attachTag(entryId, tagId) {
  const { error } = await supabase
    .from('journal_entry_tags')
    .insert({ entry_id: entryId, tag_id: tagId });
  if (error) throw error;
}

export async function detachTag(entryId, tagId) {
  const { error } = await supabase
    .from('journal_entry_tags')
    .delete()
    .eq('entry_id', entryId)
    .eq('tag_id', tagId);
  if (error) throw error;
}
