import { fetchCharacters } from './characterApi.js';
import { navigate } from '../../app/router.js';
import { getState, setActiveCharacter, setState } from '../../app/state.js';
import { createToast } from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';

export async function renderCharacterSelect(container) {
  container.innerHTML = `<section class="card"><p>Caricamento...</p></section>`;
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

  const activeCharacter = characters.find((char) => char.id === state.activeCharacterId);

  container.innerHTML = `
    <section class="card">
      <header class="character-select-header">
        <div>
          <h2>Seleziona personaggio</h2>
          <p class="muted">Scegli una scheda per aprire la home del personaggio.</p>
        </div>
      </header>
      <div class="character-card-grid">
        ${characters.length
    ? characters.map((character) => buildCharacterCard(character, character.id === activeCharacter?.id)).join('')
    : '<p>Non hai ancora creato un personaggio.</p>'}
      </div>
    </section>
  `;

  container.querySelectorAll('[data-character-card]')
    .forEach((card) => {
      card.addEventListener('click', () => {
        setActiveCharacter(card.dataset.characterCard);
        navigate('home');
      });
    });
}

function buildCharacterCard(character, isActive) {
  const data = character.data || {};
  const avatar = data.avatar_url
    ? `<img src="${data.avatar_url}" alt="Ritratto di ${character.name}" />`
    : `<span>${getInitials(character.name)}</span>`;
  return `
    <button class="character-card ${isActive ? 'is-active' : ''}" type="button" data-character-card="${character.id}">
      <div class="character-card-avatar">
        ${avatar}
      </div>
      <div>
        <h3>${character.name}</h3>
        <p class="muted">${character.system || 'Sistema non specificato'}</p>
      </div>
    </button>
  `;
}

function getInitials(name = '') {
  const parts = name.split(' ').filter(Boolean);
  if (!parts.length) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
