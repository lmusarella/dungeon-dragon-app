import { supabase } from '../lib/supabase.js';
import { setState } from './state.js';

export async function initSession() {
  const { data } = await supabase.auth.getSession();
  setState({ user: data.session?.user ?? null });
  supabase.auth.onAuthStateChange((_event, session) => {
    setState({ user: session?.user ?? null });
  });
}

export async function ensureProfile(user) {
  if (!user) return;
  await supabase.from('profiles').upsert({
    id: user.id,
    display_name: user.user_metadata?.display_name ?? ''
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}
