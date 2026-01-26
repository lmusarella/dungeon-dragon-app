import { supabase } from '../../lib/supabase.js';

export async function fetchCharacters(userId) {
  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCharacter(payload) {
  const { data, error } = await supabase
    .from('characters')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateResourcesReset(characterId, resetOn) {
  const resetTargets = resetOn === 'long_rest'
    ? ['short_rest', 'long_rest']
    : ['short_rest'];
  const { error } = await supabase
    .from('resources')
    .update({ used: 0 })
    .eq('character_id', characterId)
    .in('reset_on', resetTargets);
  if (error) throw error;
}

export async function fetchResources(characterId) {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('character_id', characterId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}
