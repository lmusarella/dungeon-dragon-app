# Dungeon Dragon

PWA tablet-first per gestire un personaggio di D&D con Supabase.

## Setup

1. Installa dipendenze:

```bash
npm install
```

2. Crea `.env` con le variabili:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

3. Avvia l'app:

```bash
npm run dev
```

## Script utili

```bash
npm run dev
npm run build
npm run preview
npm run test
```

## Tabelle Supabase (assunte)

- `profiles(id, display_name, created_at)`
- `characters(id, user_id, name, system, data, created_at, updated_at)`
- `items(id, user_id, character_id, name, qty, weight, value_cp, category, container_item_id, equipped_state, attunement_required, attunement_active, notes, created_at, updated_at)`
- `resources(id, user_id, character_id, name, max_uses, used, reset_on, notes, created_at, updated_at)`
- `wallets(character_id, user_id, cp, sp, ep, gp, pp, updated_at)`
- `money_transactions(id, user_id, character_id, direction, amount, reason, occurred_on, created_at)`
- `journal_entries(id, user_id, character_id, entry_date, session_no, title, content, mood, is_pinned, created_at, updated_at)`
- `journal_tags(id, user_id, name, created_at)`
- `journal_entry_tags(entry_id, tag_id)`

RLS: assumere che tutte le tabelle siano protette con `auth.uid()` come owner.

## Come usare l'app

1. Login con email + password.
2. Home: seleziona il personaggio, verifica HP/AC, esegui riposo breve/lungo.
3. Inventario: aggiungi, modifica e organizza oggetti (anche in contenitori).
4. Equip: controlla stato di equipaggiamento e attunement.
5. Azioni: gestisci wallet, registra pagamenti o incassi, loot rapido.
6. Diario: crea voci, aggiungi tag e ricerca veloce.
7. Impostazioni: imposta modalità ingombro e unità peso.

## Offline

- Quando offline, l'app usa la cache IndexedDB (solo lettura).
- Un banner rosso indica lo stato offline.
