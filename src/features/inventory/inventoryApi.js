import { supabase } from '../../lib/supabase.js';

export async function fetchItems(characterId) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('character_id', characterId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createItem(payload) {
  const { data, error } = await supabase
    .from('items')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, payload) {
  const { data, error } = await supabase
    .from('items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id) {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
