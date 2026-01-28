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

export async function updateCharacter(id, payload) {
  const { data, error } = await supabase
    .from('characters')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateResourcesReset(characterId, resetOn) {
  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('character_id', characterId);
  if (error) throw error;
  const resources = data ?? [];
  const updates = resources
    .map((resource) => {
      const maxUses = Number(resource.max_uses) || 0;
      const used = Number(resource.used) || 0;
      if (maxUses === 0 || used === 0) return null;
      if (resource.reset_on === 'none') return null;
      const recoveryShort = Number(resource.recovery_short);
      const recoveryLong = Number(resource.recovery_long);
      const defaultShort = resource.reset_on === 'short_rest' ? maxUses : 0;
      const defaultLong = resource.reset_on === 'long_rest' ? maxUses : 0;
      const shortRecovery = Number.isNaN(recoveryShort) ? defaultShort : recoveryShort;
      const longRecovery = Number.isNaN(recoveryLong) ? defaultLong : recoveryLong;
      if (resetOn === 'short_rest' && resource.reset_on !== 'short_rest') return null;
      const useShortRecovery = resetOn === 'short_rest'
        || (resetOn === 'long_rest' && resource.reset_on === 'short_rest');
      const recovery = useShortRecovery ? shortRecovery : longRecovery;
      if (!recovery) return null;
      const nextUsed = Math.max(used - recovery, 0);
      if (nextUsed === used) return null;
      return { id: resource.id, used: nextUsed };
    })
    .filter(Boolean);
  if (!updates.length) return;
  const { error: updateError } = await supabase
    .from('resources')
    .upsert(updates, { onConflict: 'id' });
  if (updateError) throw updateError;
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

export async function createResource(payload) {
  const { data, error } = await supabase
    .from('resources')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateResource(id, payload) {
  const { data, error } = await supabase
    .from('resources')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteResource(id) {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
