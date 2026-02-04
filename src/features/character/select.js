import { fetchCharacters } from './characterApi.js';
import { navigate } from '../../app/router.js';
import { getState, normalizeCharacterId, setActiveCharacter, setState } from '../../app/state.js';
import { createToast } from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { openCharacterDrawer } from './home/characterDrawer.js';

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

  const activeId = normalizeCharacterId(state.activeCharacterId);
  const activeCharacter = characters.find((char) => normalizeCharacterId(char.id) === activeId);

  const canCreateCharacter = Boolean(user) && !offline;

  container.innerHTML = `
    <section class="card">
      <header class="character-select-header">
        <div>
          <h2>Seleziona personaggio</h2>
          <p class="muted">Scegli una scheda per aprire la home del personaggio.</p>
        </div>
        ${canCreateCharacter ? '<button class="icon-button icon-button--add character-select-add" type="button" data-create-character aria-label="Nuovo personaggio" title="Nuovo personaggio">+</button>' : ''}
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

  const createButton = container.querySelector('[data-create-character]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderCharacterSelect(container));
    });
  }
}

function buildCharacterCard(character, isActive) {
  const data = character.data || {};
  const avatar = data.avatar_url
    ? `<img src="${data.avatar_url}" alt="Ritratto di ${character.name}" />`
    : `<span>${getInitials(character.name)}</span>`;
  const levelLabel = data.level ? `Livello ${data.level}` : null;
  const classLabel = data.class_name || data.class_archetype || data.archetype;
  const primaryMeta = [levelLabel, classLabel].filter(Boolean);
  const secondaryMeta = [data.race].filter(Boolean).join(' · ');
  return `
    <button class="character-card ${isActive ? 'is-active' : ''}" type="button" data-character-card="${character.id}">
      <div class="character-card-avatar">
        ${avatar}
      </div>
      <div class="character-card-info">
        <h3>${character.name}</h3>
        ${primaryMeta.length
    ? `<div class="character-card-tags">
            ${primaryMeta.map((item) => `<span class="character-tag">${item}</span>`).join('')}
          </div>`
    : '<p class="character-card-meta muted">Dettagli base non specificati</p>'}
        ${secondaryMeta ? `<p class="character-card-detail muted">${secondaryMeta}</p>` : ''}
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
