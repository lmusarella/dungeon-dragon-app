import { fetchCharacters, fetchResources, updateResourcesReset } from './characterApi.js';
import { getState, setActiveCharacter, setState, updateCache } from '../../app/state.js';
import { createToast } from '../../ui/components.js';
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
      ${activeCharacter ? buildCharacterSummary(activeCharacter) : '<p>Nessun personaggio.</p>'}
    </section>
    <section class="card">
      <h3>Risorse</h3>
      ${resources.length ? buildResourceList(resources) : '<p>Nessuna risorsa.</p>'}
      <div class="button-row">
        <button class="primary" data-rest="short_rest">Riposo breve</button>
        <button class="primary" data-rest="long_rest">Riposo lungo</button>
      </div>
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
