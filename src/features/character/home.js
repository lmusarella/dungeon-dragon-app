import {
  createCharacter,
  fetchCharacters,
  fetchResources,
  updateResourcesReset
} from './characterApi.js';
import { getState, setActiveCharacter, setState, updateCache } from '../../app/state.js';
import {
  buildDrawerLayout,
  buildInput,
  closeDrawer,
  createToast,
  openDrawer
} from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';

export async function renderHome(container) {
  container.innerHTML = `<div class="card"><p>Caricamento...</p></div>`;
  const state = getState();
  const { user, offline } = state;

  let characters = state.characters;
  if (!offline && user) {
    try {
      characters = await fetchCharacters(user.id);
      setState({ characters });
      await cacheSnapshot({ characters });
    } catch (error) {
      createToast('Errore caricamento personaggi', 'error');
    }
  }

  if (!state.activeCharacterId && characters.length) {
    setActiveCharacter(characters[0].id);
  }

  const activeCharacter = characters.find((char) => char.id === getState().activeCharacterId);
  const canCreateCharacter = Boolean(user) && !offline;

  let resources = state.cache.resources;
  if (!offline && activeCharacter) {
    try {
      resources = await fetchResources(activeCharacter.id);
      updateCache('resources', resources);
      await cacheSnapshot({ resources });
    } catch (error) {
      createToast('Errore caricamento risorse', 'error');
    }
  }

  container.innerHTML = `
    <section class="card">
      <header class="card-header">
        <h2>Personaggio</h2>
        ${characters.length > 1 ? '<select data-character-select></select>' : ''}
      </header>
      ${activeCharacter ? buildCharacterSummary(activeCharacter) : buildEmptyState(canCreateCharacter, offline)}
    </section>
    <section class="card">
      <h3>Risorse</h3>
      ${activeCharacter
    ? (resources.length ? buildResourceList(resources) : '<p>Nessuna risorsa.</p>')
    : '<p>Nessun personaggio selezionato.</p>'}
      ${activeCharacter ? `
        <div class="button-row">
          <button class="primary" data-rest="short_rest">Riposo breve</button>
          <button class="primary" data-rest="long_rest">Riposo lungo</button>
        </div>
      ` : ''}
    </section>
  `;

  const select = container.querySelector('[data-character-select]');
  if (select) {
    characters.forEach((character) => {
      const option = document.createElement('option');
      option.value = character.id;
      option.textContent = character.name;
      if (character.id === activeCharacter?.id) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', (event) => {
      setActiveCharacter(event.target.value);
      renderHome(container);
    });
  }

  const createButton = container.querySelector('[data-create-character]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderHome(container));
    });
  }

  container.querySelectorAll('[data-rest]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resetOn = button.dataset.rest;
      if (!activeCharacter) return;
      if (!confirm('Confermi il riposo?')) return;
      try {
        await updateResourcesReset(activeCharacter.id, resetOn);
        createToast('Risorse aggiornate');
        const refreshed = await fetchResources(activeCharacter.id);
        updateCache('resources', refreshed);
        await cacheSnapshot({ resources: refreshed });
        renderHome(container);
      } catch (error) {
        createToast('Errore aggiornamento risorse', 'error');
      }
    }));
}

function buildEmptyState(canCreateCharacter, offline) {
  if (!canCreateCharacter) {
    const message = offline
      ? 'Modalità offline attiva: crea un personaggio quando torni online.'
      : 'Accedi per creare un personaggio.';
    return `<p class="muted">${message}</p>`;
  }
  return `
    <div>
      <p>Non hai ancora un personaggio.</p>
      <div class="button-row">
        <button class="primary" data-create-character>Nuovo personaggio</button>
      </div>
    </div>
  `;
}

function openCharacterDrawer(user, onSave) {
  if (!user) return;
  const form = document.createElement('form');
  form.className = 'drawer-form';
  form.appendChild(buildInput({ label: 'Nome', name: 'name', placeholder: 'Es. Aria' }));
  form.appendChild(buildInput({ label: 'Sistema', name: 'system', placeholder: 'Es. D&D 5e' }));
  form.appendChild(buildInput({ label: 'HP attuali', name: 'hp_current', type: 'number', value: '' }));
  form.appendChild(buildInput({ label: 'HP massimi', name: 'hp_max', type: 'number', value: '' }));
  form.appendChild(buildInput({ label: 'Classe Armatura', name: 'ac', type: 'number', value: '' }));
  form.appendChild(buildInput({ label: 'Velocità', name: 'speed', type: 'number', value: '' }));

  const submit = document.createElement('button');
  submit.className = 'primary';
  submit.type = 'submit';
  submit.textContent = 'Crea';
  form.appendChild(submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const name = formData.get('name')?.trim();
    if (!name) {
      createToast('Inserisci un nome per il personaggio', 'error');
      return;
    }
    const toNumberOrNull = (value) => (value === '' ? null : Number(value));
    const payload = {
      user_id: user.id,
      name,
      system: formData.get('system')?.trim() || null,
      data: {
        hp: {
          current: toNumberOrNull(formData.get('hp_current')),
          max: toNumberOrNull(formData.get('hp_max'))
        },
        ac: toNumberOrNull(formData.get('ac')),
        speed: toNumberOrNull(formData.get('speed'))
      }
    };

    try {
      const created = await createCharacter(payload);
      const nextCharacters = [...getState().characters, created];
      setState({ characters: nextCharacters });
      setActiveCharacter(created.id);
      await cacheSnapshot({ characters: nextCharacters });
      createToast('Personaggio creato');
      closeDrawer();
      onSave();
    } catch (error) {
      createToast('Errore creazione personaggio', 'error');
    }
  });

  openDrawer(buildDrawerLayout('Nuovo personaggio', form));
}

function buildCharacterSummary(character) {
  const data = character.data || {};
  const hp = data.hp || {};
  return `
    <div class="character-summary">
      <div>
        <h3>${character.name}</h3>
        <p class="muted">${character.system ?? 'Sistema'} </p>
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <span>HP</span>
          <strong>${hp.current ?? '-'} / ${hp.max ?? '-'}</strong>
        </div>
        <div class="stat-card">
          <span>CA</span>
          <strong>${data.ac ?? '-'}</strong>
        </div>
        <div class="stat-card">
          <span>Velocità</span>
          <strong>${data.speed ?? '-'} </strong>
        </div>
      </div>
    </div>
  `;
}

function buildResourceList(resources) {
  return `
    <ul class="resource-list">
      ${resources.map((res) => `
        <li>
          <div>
            <strong>${res.name}</strong>
            <p class="muted">${res.reset_on}</p>
          </div>
          <span>${res.used}/${res.max_uses}</span>
        </li>
      `).join('')}
    </ul>
  `;
}
