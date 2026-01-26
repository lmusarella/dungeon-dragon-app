import { supabase } from '../../lib/supabase.js';

export async function fetchWallet(characterId) {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('character_id', characterId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function upsertWallet(payload) {
  const { data, error } = await supabase
    .from('wallets')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function createTransaction(payload) {
  const { data, error } = await supabase
    .from('money_transactions')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
