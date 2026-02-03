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

export async function fetchTransactions(characterId) {
  const { data, error } = await supabase
    .from('money_transactions')
    .select('*')
    .eq('character_id', characterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateTransaction(id, payload) {
  const { data, error } = await supabase
    .from('money_transactions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase
    .from('money_transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
