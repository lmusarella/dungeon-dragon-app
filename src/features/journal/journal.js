import {
  fetchEntries,
  fetchTags,
  fetchEntryTags,
  createEntry,
  updateEntry,
  deleteEntry,
  createTag,
  attachTag,
  detachTag
} from './journalApi.js';
import { getState, updateCache } from '../../app/state.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { buildDrawerLayout, buildInput, buildTextarea, createToast, openDrawer, closeDrawer } from '../../ui/components.js';

export async function renderJournal(container) {
  const state = getState();
  const activeCharacter = state.characters.find((char) => char.id === state.activeCharacterId);
  if (!activeCharacter) {
    container.innerHTML = '<section class="card"><p>Nessun personaggio selezionato.</p></section>';
    return;
  }

  let entries = state.cache.journal;
  let tags = state.cache.tags;
  let entryTags = [];
  if (!state.offline) {
    try {
      entries = await fetchEntries(activeCharacter.id);
      tags = await fetchTags(activeCharacter.user_id);
      entryTags = await fetchEntryTags(entries.map((entry) => entry.id));
      updateCache('journal', entries);
      updateCache('tags', tags);
      await cacheSnapshot({ journal: entries, tags, entryTags });
    } catch (error) {
      createToast('Errore caricamento diario', 'error');
    }
  }

  const tagMap = new Map(tags.map((tag) => [tag.id, tag]));
  const entryTagMap = entryTags.reduce((acc, link) => {
    if (!acc[link.entry_id]) acc[link.entry_id] = [];
    acc[link.entry_id].push(link.tag_id);
    return acc;
  }, {});

  const pinned = entries.filter((entry) => entry.is_pinned);
  const normal = entries.filter((entry) => !entry.is_pinned);

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Diario</h2>
        <button class="primary" data-add-entry>Nuova voce</button>
      </header>
      <div class="filters">
        <input type="search" placeholder="Cerca" data-search />
        <button data-add-tag class="ghost-button">Nuovo tag</button>
      </div>
      <div data-journal-list></div>
    </section>
  `;

  const listEl = container.querySelector('[data-journal-list]');
  const searchInput = container.querySelector('[data-search]');

  function renderList() {
    const term = searchInput.value.toLowerCase();
    const filteredPinned = filterEntries(pinned, term);
    const filteredNormal = filterEntries(normal, term);
    listEl.innerHTML = [
      filteredPinned.length ? '<h3>In evidenza</h3>' + buildEntryList(filteredPinned, entryTagMap, tagMap) : '',
      filteredNormal.length ? '<h3>Voci</h3>' + buildEntryList(filteredNormal, entryTagMap, tagMap) : '<p class="muted">Nessuna voce.</p>'
    ].join('');

    listEl.querySelectorAll('[data-edit]')
      .forEach((btn) => btn.addEventListener('click', () => {
        const entry = entries.find((item) => item.id === btn.dataset.edit);
        if (entry) openEntryDrawer(activeCharacter, entry, tags, entryTagMap[entry.id] ?? [], refresh);
      }));
    listEl.querySelectorAll('[data-delete]')
      .forEach((btn) => btn.addEventListener('click', async () => {
        const entry = entries.find((item) => item.id === btn.dataset.delete);
        if (!entry) return;
        if (!confirm('Eliminare voce?')) return;
        try {
          await deleteEntry(entry.id);
          createToast('Voce eliminata');
          refresh();
        } catch (error) {
          createToast('Errore eliminazione', 'error');
        }
      }));
  }

  async function refresh() {
    await renderJournal(container);
  }

  renderList();
  searchInput.addEventListener('input', renderList);
  container.querySelector('[data-add-entry]').addEventListener('click', () => {
    openEntryDrawer(activeCharacter, null, tags, [], refresh);
  });
  container.querySelector('[data-add-tag]').addEventListener('click', () => {
    openTagDrawer(activeCharacter, refresh);
  });
}

function filterEntries(entries, term) {
  if (!term) return entries;
  return entries.filter((entry) =>
    entry.title?.toLowerCase().includes(term) || entry.content?.toLowerCase().includes(term)
  );
}

function buildEntryList(entries, entryTagMap, tagMap) {
  return `
    <ul class="journal-list">
      ${entries.map((entry) => {
        const tagIds = entryTagMap[entry.id] ?? [];
        return `
          <li>
            <div>
              <strong>${entry.title || 'Senza titolo'}</strong>
              <p class="muted">${entry.entry_date || ''} · Sessione ${entry.session_no ?? '-'}</p>
              <div class="tag-row">
                ${tagIds.map((id) => `<span class="chip">${tagMap.get(id)?.name ?? ''}</span>`).join('')}
              </div>
            </div>
            <div class="actions">
              <button data-edit="${entry.id}">Modifica</button>
              <button data-delete="${entry.id}">Elimina</button>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function openEntryDrawer(character, entry, tags, selectedTags, onSave) {
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Titolo', name: 'title', value: entry?.title ?? '' }));
  form.appendChild(buildInput({ label: 'Data', name: 'entry_date', type: 'date', value: entry?.entry_date ?? new Date().toISOString().split('T')[0] }));
  form.appendChild(buildInput({ label: 'Sessione', name: 'session_no', type: 'number', value: entry?.session_no ?? '' }));
  form.appendChild(buildTextarea({ label: 'Contenuto', name: 'content', value: entry?.content ?? '' }));
  const pinnedField = document.createElement('label');
  pinnedField.className = 'checkbox';
  pinnedField.innerHTML = '<input type="checkbox" name="is_pinned" /> <span>In evidenza</span>';
  form.appendChild(pinnedField);

  const tagWrap = document.createElement('div');
  tagWrap.className = 'tag-selector';
  tagWrap.innerHTML = '<span>Tag</span>';
  tags.forEach((tag) => {
    const label = document.createElement('label');
    label.className = 'checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = tag.id;
    if (selectedTags.includes(tag.id)) input.checked = true;
    label.appendChild(input);
    label.append(tag.name);
    tagWrap.appendChild(label);
  });
  form.appendChild(tagWrap);

  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.type = 'submit';
  submit.textContent = entry ? 'Salva' : 'Crea';
  form.appendChild(submit);

  form.is_pinned.checked = entry?.is_pinned ?? false;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      user_id: character.user_id,
      character_id: character.id,
      title: formData.get('title'),
      entry_date: formData.get('entry_date'),
      session_no: Number(formData.get('session_no') || 0),
      content: formData.get('content'),
      is_pinned: formData.get('is_pinned') === 'on'
    };

    try {
      const saved = entry
        ? await updateEntry(entry.id, payload)
        : await createEntry(payload);
      const selected = Array.from(tagWrap.querySelectorAll('input[type="checkbox"]'))
        .filter((input) => input.checked)
        .map((input) => input.value);
      if (entry) {
        const toAdd = selected.filter((id) => !selectedTags.includes(id));
        const toRemove = selectedTags.filter((id) => !selected.includes(id));
        await Promise.all([
          ...toAdd.map((id) => attachTag(saved.id, id)),
          ...toRemove.map((id) => detachTag(saved.id, id))
        ]);
      } else {
        await Promise.all(selected.map((id) => attachTag(saved.id, id)));
      }
      createToast('Voce salvata');
      closeDrawer();
      onSave();
    } catch (error) {
      createToast('Errore salvataggio voce', 'error');
    }
  });

  openDrawer(buildDrawerLayout(entry ? 'Modifica voce' : 'Nuova voce', form));
}

function openTagDrawer(character, onSave) {
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome tag', name: 'name' }));
  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.type = 'submit';
  submit.textContent = 'Crea';
  form.appendChild(submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    try {
      await createTag({ user_id: character.user_id, name: formData.get('name') });
      createToast('Tag creato');
      closeDrawer();
      onSave();
    } catch (error) {
      createToast('Errore tag', 'error');
    }
  });

  openDrawer(buildDrawerLayout('Nuovo tag', form));
}
