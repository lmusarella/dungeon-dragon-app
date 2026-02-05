import { deleteResource, fetchCharacters, fetchResources, updateResource, updateResourcesReset } from './characterApi.js';
import { createItem, fetchItems, updateItem } from '../inventory/inventoryApi.js';
import { getState, normalizeCharacterId, setActiveCharacter, setState, updateCache } from '../../app/state.js';
import { buildInput, createToast, openConfirmModal, openFormModal } from '../../ui/components.js';
import { cacheSnapshot } from '../../lib/offline/cache.js';
import { openDiceOverlay } from '../dice-roller/overlay/dice.js';
import { openCharacterDrawer } from './home/characterDrawer.js';
import {
  buildAttackSection,
  buildCharacterOverview,
  buildEquipSection,
  buildEmptyState,
  buildResourceSections,
  buildSavingThrowSection,
  buildSkillList,
  buildSpellSection
} from './home/sections.js';
import { buildLootFields, moneyFields } from '../inventory/render.js';
import { openItemImageModal } from '../inventory/modals.js';
import { getWeightUnit } from '../inventory/utils.js';
import { bodyParts } from '../inventory/constants.js';
import { fetchWallet, upsertWallet, createTransaction } from '../wallet/walletApi.js';
import {
  openAvatarModal,
  openBackgroundModal,
  openConditionsModal,
  openPreparedSpellsModal,
  openResourceDetail,
  openResourceDrawer,
  openSpellDrawer,
  openSpellListModal
} from './home/modals.js';
import { saveCharacterData } from './home/data.js';
import { abilityShortLabel, savingThrowList, skillList } from './home/constants.js';
import {
  applyRestRecovery,
  buildSpellDamageOverlayConfig,
  buildWeaponDamageOverlayConfig,
  calculateSkillModifier,
  formatSigned,
  getAbilityModifier,
  getEquipSlots,
  getHitDiceSides,
  normalizeNumber,
  rollDie
} from './home/utils.js';
import { applyMoneyDelta } from '../../lib/calc.js';

let fabHandlersBound = false;
let lastHomeContainer = null;

export async function renderHome(container) {
  lastHomeContainer = container;
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

  const activeId = normalizeCharacterId(state.activeCharacterId);
  const hasActive = characters.some((char) => normalizeCharacterId(char.id) === activeId);
  if (!hasActive && characters.length) {
    setActiveCharacter(characters[0].id);
  }

  const resolvedActiveId = normalizeCharacterId(getState().activeCharacterId);
  const activeCharacter = characters.find((char) => normalizeCharacterId(char.id) === resolvedActiveId);
  const canCreateCharacter = Boolean(user) && !offline;
  const canManageResources = Boolean(user) && !offline;
  const canEditCharacter = Boolean(user) && !offline;

  let resources = state.cache.resources;
  let items = state.cache.items;
  if (!offline && activeCharacter) {
    const [resourcesResult, itemsResult] = await Promise.allSettled([
      fetchResources(activeCharacter.id),
      fetchItems(activeCharacter.id)
    ]);
    const snapshot = {};
    if (resourcesResult.status === 'fulfilled') {
      resources = resourcesResult.value;
      updateCache('resources', resources);
      snapshot.resources = resources;
    } else {
      createToast('Errore caricamento risorse', 'error');
    }
    if (itemsResult.status === 'fulfilled') {
      items = itemsResult.value;
      updateCache('items', items);
      snapshot.items = items;
    } else {
      createToast('Errore caricamento equip', 'error');
    }
    if (Object.keys(snapshot).length) {
      await cacheSnapshot(snapshot);
    }
  }

  container.innerHTML = `
    <div class="home-layout">
      <div class="home-column home-column--left">
        <section class="card home-card home-section">
          <header class="card-header">
            <div>
              <p class="eyebrow">Tiri salvezza</p>
              <h3></h3>
            </div>
            <div class="actions">
              <button class="icon-button" data-open-dice="saving-throws" aria-label="Lancia dadi tiri salvezza">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          ${activeCharacter ? buildSavingThrowSection(activeCharacter) : '<p>Nessun personaggio selezionato.</p>'}
        </section>
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Abilità</p>            
            </div>
            <div class="actions">
              <button class="icon-button" data-open-dice="skills" aria-label="Lancia dadi abilità">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          <div class="home-scroll-body">
            ${activeCharacter ? buildSkillList(activeCharacter) : '<p>Nessun personaggio selezionato.</p>'}
          </div>
        </section>
      </div>
      <div class="home-column home-column--center">
        <section class="card home-card home-section">
          <header class="card-header">
            <div>
              <p class="eyebrow">Scheda Personaggio</p>           
            </div>
            <div class="actions">
              ${activeCharacter && canEditCharacter ? `
                <button class="icon-button" data-edit-character aria-label="Modifica personaggio">
                  <span aria-hidden="true">✏️</span>
                </button>
              ` : ''}
            </div>
          </header>
          ${activeCharacter ? buildCharacterOverview(activeCharacter, canEditCharacter, items) : buildEmptyState(canCreateCharacter, offline)}
        </section>
        ${activeCharacter ? buildEquipSection(activeCharacter, items, canEditCharacter) : ''}
      </div>
      <div class="home-column home-column--right">
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Attacchi</p>
            </div>
            <div class="actions">
              <button class="icon-button icon-button--dice" data-open-dice="attack-roll" aria-label="Lancia dadi attacchi">
                <span aria-hidden="true">🎲</span>
              </button>
            </div>
          </header>
          <div class="home-scroll-body">
            ${activeCharacter
    ? buildAttackSection(activeCharacter, items || [])
    : '<p>Nessun personaggio selezionato.</p>'}
          </div>
        </section>
        ${activeCharacter?.data?.is_spellcaster ? `
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Incantesimi</p>
            </div>
            ${activeCharacter && canEditCharacter ? `
              <button class="icon-button icon-button--add" data-add-spell aria-label="Aggiungi incantesimo">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </header>
          <div class="home-scroll-body">
            ${buildSpellSection(activeCharacter)}
          </div>
        </section>
        ` : ''}
        <section class="card home-card home-section home-scroll-panel">
          <header class="card-header">
            <div>
              <p class="eyebrow">Risorse</p>           
            </div>
            ${activeCharacter && canManageResources ? `
              <button class="icon-button icon-button--add" data-add-resource aria-label="Nuova risorsa">
                <span aria-hidden="true">+</span>
              </button>
            ` : ''}
          </header>
          <div class="home-scroll-body home-scroll-body--resources">
            ${activeCharacter
    ? buildResourceSections(resources, canManageResources)
    : '<p>Nessun personaggio selezionato.</p>'}
            ${activeCharacter && !canManageResources ? '<p class="muted">Connettiti per aggiungere nuove risorse.</p>' : ''}
          </div>
        </section>
      </div>
    </div>
  `;

  bindFabHandlers();

  const createButton = container.querySelector('[data-create-character]');
  if (createButton) {
    createButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderHome(container));
    });
  }

  const editButton = container.querySelector('[data-edit-character]');
  if (editButton) {
    editButton.addEventListener('click', () => {
      openCharacterDrawer(user, () => renderHome(container), activeCharacter);
    });
  }

  const addResourceButton = container.querySelector('[data-add-resource]');
  if (addResourceButton) {
    addResourceButton.addEventListener('click', () => {
      openResourceDrawer(activeCharacter, () => renderHome(container));
    });
  }

  const addSpellButton = container.querySelector('[data-add-spell]');
  if (addSpellButton) {
    addSpellButton.addEventListener('click', () => {
      openSpellDrawer(activeCharacter, () => renderHome(container));
    });
  }

  const spellListButton = container.querySelector('[data-spell-list]');
  if (spellListButton) {
    spellListButton.addEventListener('click', () => {
      openSpellListModal(activeCharacter, () => renderHome(container));
    });
  }

  const backgroundButton = container.querySelector('[data-show-background]');
  if (backgroundButton) {
    backgroundButton.addEventListener('click', () => {
      openBackgroundModal(activeCharacter);
    });
  }

  const conditionsButton = container.querySelector('[data-edit-conditions]');
  if (conditionsButton) {
    conditionsButton.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const formData = await openConditionsModal(activeCharacter);
      if (!formData) return;
      const selected = formData.getAll('conditions');
      await saveCharacterData(activeCharacter, {
        ...activeCharacter.data,
        conditions: selected
      }, 'Condizioni aggiornate', () => renderHome(container));
    });
  }

  container.querySelectorAll('[data-proficiency-tabs]')
    .forEach((tabGroup) => {
      const buttons = Array.from(tabGroup.querySelectorAll('[data-proficiency-tab]'));
      const panels = Array.from(tabGroup.querySelectorAll('[data-proficiency-panel]'));
      if (!buttons.length || !panels.length) return;
      const setActiveTab = (tabKey) => {
        buttons.forEach((button) => {
          const isActive = button.dataset.proficiencyTab === tabKey;
          button.classList.toggle('is-active', isActive);
          button.setAttribute('aria-selected', String(isActive));
        });
        panels.forEach((panel) => {
          panel.classList.toggle('is-active', panel.dataset.proficiencyPanel === tabKey);
        });
      };
      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          setActiveTab(button.dataset.proficiencyTab);
        });
      });
      const defaultTab = buttons.find((button) => button.classList.contains('is-active'))?.dataset.proficiencyTab
        ?? buttons[0].dataset.proficiencyTab;
      if (defaultTab) setActiveTab(defaultTab);
    });

  const addEquipButton = container.querySelector('[data-add-equip]');
  if (addEquipButton && activeCharacter && canEditCharacter) {
    addEquipButton.addEventListener('click', async () => {
      const equipableItems = (items || []).filter((item) => item.equipable && !getEquipSlots(item).length);
      if (!equipableItems.length) {
        createToast('Nessun oggetto equipaggiabile disponibile', 'error');
        return;
      }
      const content = document.createElement('div');
      content.className = 'drawer-form';
      const itemField = document.createElement('label');
      itemField.className = 'field';
      itemField.innerHTML = '<span>Oggetto</span>';
      const itemSelect = document.createElement('select');
      itemSelect.name = 'item_id';
      equipableItems.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        itemSelect.appendChild(option);
      });
      itemField.appendChild(itemSelect);
      content.appendChild(itemField);

      const equipSlotsField = document.createElement('fieldset');
      equipSlotsField.className = 'equip-slot-field';
      equipSlotsField.innerHTML = '<legend>Punti del corpo</legend>';
      const equipSlotList = document.createElement('div');
      equipSlotList.className = 'equip-slot-list';
      bodyParts.forEach((part) => {
        const label = document.createElement('label');
        label.className = 'checkbox';
        label.innerHTML = `<input type="checkbox" name="equip_slots" value="${part.value}" /> <span>${part.label}</span>`;
        equipSlotList.appendChild(label);
      });
      equipSlotsField.appendChild(equipSlotList);
      content.appendChild(equipSlotsField);

      const formData = await openFormModal({
        title: 'Equipaggia oggetto',
        submitLabel: 'Equipaggia',
        content
      });
      if (!formData) return;
      const equipSlots = formData.getAll('equip_slots');
      if (!equipSlots.length) {
        createToast('Seleziona almeno uno slot', 'error');
        return;
      }
      const item = equipableItems.find((entry) => String(entry.id) === formData.get('item_id'));
      if (!item) return;
      const proficiencies = activeCharacter.data?.proficiencies || {};
      if (item.category === 'weapon') {
        if (!item.weapon_type) {
          createToast('Definisci il tipo di arma prima di equipaggiarla', 'error');
          return;
        }
        const proficient = item.weapon_type === 'simple'
          ? Boolean(proficiencies.weapon_simple)
          : Boolean(proficiencies.weapon_martial);
        if (!proficient) {
          createToast('Non hai la competenza per equipaggiare questo oggetto', 'error');
          return;
        }
      }
      if (item.category === 'armor') {
        if (item.is_shield) {
          if (!proficiencies.shield) {
            createToast('Non hai la competenza per equipaggiare questo oggetto', 'error');
            return;
          }
        } else if (!item.armor_type) {
          createToast('Definisci il tipo di armatura prima di equipaggiarla', 'error');
          return;
        } else {
          const proficient = item.armor_type === 'light'
            ? Boolean(proficiencies.armor_light)
            : item.armor_type === 'medium'
              ? Boolean(proficiencies.armor_medium)
              : Boolean(proficiencies.armor_heavy);
          if (!proficient) {
            createToast('Non hai la competenza per equipaggiare questo oggetto', 'error');
            return;
          }
        }
      }
      if (!item.sovrapponibile) {
        const conflicting = (items || [])
          .filter((entry) => entry.id !== item.id)
          .filter((entry) => getEquipSlots(entry).some((slot) => equipSlots.includes(slot)));
        if (conflicting.length) {
          createToast('Uno o più slot selezionati sono già occupati', 'error');
          return;
        }
      }
      try {
        await updateItem(item.id, { equip_slot: equipSlots[0] || null, equip_slots: equipSlots });
        createToast('Equip aggiornato');
        renderHome(container);
      } catch (error) {
        createToast('Errore aggiornamento equip', 'error');
      }
    });
  }

  container.querySelectorAll('[data-unequip]')
    .forEach((btn) => btn.addEventListener('click', async () => {
      const item = (items || []).find((entry) => entry.id === btn.dataset.unequip);
      if (!item) return;
      try {
        await updateItem(item.id, { equip_slot: null, equip_slots: [] });
        createToast('Equip rimosso');
        renderHome(container);
      } catch (error) {
        createToast('Errore aggiornamento equip', 'error');
      }
    }));

  const inspirationButton = container.querySelector('[data-toggle-inspiration]');
  if (inspirationButton && activeCharacter && canEditCharacter) {
    inspirationButton.addEventListener('click', async () => {
      const currentData = activeCharacter.data || {};
      const nextData = {
        ...currentData,
        inspiration: !currentData.inspiration
      };
      await saveCharacterData(activeCharacter, nextData, 'Ispirazione aggiornata', () => renderHome(container));
    });
  }

  container.querySelectorAll('[data-open-dice]')
    .forEach((button) => button.addEventListener('click', () => {
      handleDiceAction(button.dataset.openDice);
    }));

  container.querySelectorAll('[data-edit-resource]')
    .forEach((button) => button.addEventListener('click', () => {
      const resource = resources.find((entry) => entry.id === button.dataset.editResource);
      if (!resource) return;
      openResourceDrawer(activeCharacter, () => renderHome(container), resource);
    }));

  container.querySelectorAll('[data-roll-damage]')
    .forEach((button) => button.addEventListener('click', () => {
      if (!activeCharacter) return;
      const rollKey = button.dataset.rollDamage;
      if (!rollKey) return;
      if (rollKey.startsWith('spell:')) {
        const spellId = rollKey.replace('spell:', '');
        const spells = Array.isArray(activeCharacter.data?.spells) ? activeCharacter.data.spells : [];
        const spell = spells.find((entry) => entry.id === spellId);
        if (!spell) return;
        const overlayConfig = buildSpellDamageOverlayConfig(spell);
        if (!overlayConfig) {
          createToast('Danno non calcolabile per questo trucchetto.', 'error');
          return;
        }
        openDiceOverlay({
          keepOpen: true,
          title: overlayConfig.title,
          mode: 'generic',
          notation: overlayConfig.notation,
          modifier: overlayConfig.modifier,
          rollType: 'DMG'
        });
        return;
      }
      const weapon = items?.find((entry) => String(entry.id) === rollKey || entry.name === rollKey);
      if (!weapon) return;
      const overlayConfig = buildWeaponDamageOverlayConfig(activeCharacter, weapon);
      if (!overlayConfig) {
        createToast('Danno non calcolabile per questa arma.', 'error');
        return;
      }
      openDiceOverlay({
        keepOpen: true,
        title: overlayConfig.title,
        mode: 'generic',
        notation: overlayConfig.notation,
        modifier: overlayConfig.modifier,
        rollType: 'DMG'
      });
    }));

  container.querySelectorAll('[data-resource-card]')
    .forEach((card) => {
      const handleOpen = async (event) => {
        if (event.target.closest('button')) return;
        const resource = resources.find((entry) => entry.id === card.dataset.resourceCard);
        if (!resource) return;
        openResourceDetail(resource, {
          onUse: async () => {
            const maxUses = Number(resource.max_uses) || 0;
            if (!maxUses || resource.used >= maxUses) return;
            try {
              await updateResource(resource.id, { used: Math.min(resource.used + 1, maxUses) });
              createToast('Risorsa usata');
              renderHome(container);
            } catch (error) {
              createToast('Errore utilizzo risorsa', 'error');
            }
          },
          onReset: async () => {
            try {
              await updateResource(resource.id, { used: 0 });
              createToast('Risorsa ripristinata');
              renderHome(container);
            } catch (error) {
              createToast('Errore ripristino risorsa', 'error');
            }
          }
        });
      };
      card.addEventListener('click', handleOpen);
    });

  container.querySelectorAll('[data-use-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.useResource);
      if (!resource) return;
      const maxUses = Number(resource.max_uses) || 0;
      if (!maxUses || resource.used >= maxUses) return;
      try {
        await updateResource(resource.id, { used: Math.min(resource.used + 1, maxUses) });
        createToast('Risorsa usata');
        renderHome(container);
      } catch (error) {
        createToast('Errore utilizzo risorsa', 'error');
      }
    }));

  container.querySelectorAll('[data-delete-resource]')
    .forEach((button) => button.addEventListener('click', async () => {
      const resource = resources.find((entry) => entry.id === button.dataset.deleteResource);
      if (!resource) return;
      const shouldDelete = await openConfirmModal({ message: 'Eliminare risorsa?' });
      if (!shouldDelete) return;
      try {
        await deleteResource(resource.id);
        createToast('Risorsa eliminata');
        renderHome(container);
      } catch (error) {
        createToast('Errore eliminazione risorsa', 'error');
      }
    }));

  container.querySelectorAll('[data-death-save]')
    .forEach((button) => button.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const { deathSave: group, deathSaveIndex } = button.dataset;
      const index = Number(deathSaveIndex);
      if (!group || !index) return;
      const data = activeCharacter.data || {};
      const deathSaves = data.death_saves || {};
      const current = Math.max(0, Math.min(3, Number(deathSaves[group]) || 0));
      const nextValue = index === current ? current - 1 : index;
      const nextDeathSaves = {
        successes: Math.max(0, Math.min(3, group === 'successes' ? nextValue : Number(deathSaves.successes) || 0)),
        failures: Math.max(0, Math.min(3, group === 'failures' ? nextValue : Number(deathSaves.failures) || 0))
      };
      await saveCharacterData(activeCharacter, {
        ...data,
        death_saves: nextDeathSaves
      }, 'Tiri salvezza contro morte aggiornati', () => renderHome(container));
    }));

  container.querySelectorAll('[data-weakness-level]')
    .forEach((button) => button.addEventListener('click', async () => {
      if (!activeCharacter || !canEditCharacter) return;
      const level = Number(button.dataset.weaknessLevel);
      if (!level) return;
      const data = activeCharacter.data || {};
      const hp = data.hp || {};
      const current = Math.max(0, Math.min(6, Number(hp.weak_points) || 0));
      const nextValue = level === current ? 0 : level;
      await saveCharacterData(activeCharacter, {
        ...data,
        hp: {
          ...hp,
          weak_points: nextValue
        }
      }, 'Punti indebolimento aggiornati', () => renderHome(container));
    }));

  const avatar = container.querySelector('.character-avatar');
  if (avatar) {
    avatar.setAttribute('draggable', 'false');
    avatar.addEventListener('click', (event) => {
      event.preventDefault();
      openAvatarModal(activeCharacter);
    });
    avatar.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    avatar.addEventListener('dragstart', (event) => {
      event.preventDefault();
    });
  }

  container.querySelectorAll('[data-item-image]')
    .forEach((image) => {
      image.setAttribute('draggable', 'false');
      image.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const item = items?.find((entry) => String(entry.id) === image.dataset.itemImage);
        if (item) openItemImageModal(item);
      });
    });

}

export function bindGlobalFabHandlers() {
  bindFabHandlers();
}

function bindFabHandlers() {
  if (fabHandlersBound) return;
  document.addEventListener('click', async (event) => {
    const fabContainer = event.target.closest('[data-actions-fab]');
    if (!fabContainer) return;
    const hpButton = event.target.closest('[data-hp-action]');
    const moneyButton = event.target.closest('[data-money-action]');
    const restButton = event.target.closest('[data-rest]');
    const diceButton = event.target.closest('[data-open-dice]');
    const lootButton = event.target.closest('[data-add-loot]');
    if (!hpButton && !moneyButton && !restButton && !diceButton && !lootButton) return;
    event.preventDefault();
    const container = lastHomeContainer ?? null;
    if (hpButton) {
      await handleHpAction(hpButton.dataset.hpAction, container);
      closeFabMenu();
      return;
    }
    if (moneyButton) {
      const route = window.location.hash.replace('#/', '') || 'home';
      if (route === 'inventory') {
        closeFabMenu();
        return;
      }
      await handleMoneyAction(moneyButton.dataset.moneyAction, container);
      closeFabMenu();
      return;
    }
    if (restButton) {
      await handleRestAction(restButton.dataset.rest, container);
      closeFabMenu();
      return;
    }
    if (diceButton) {
      handleDiceAction(diceButton.dataset.openDice);
      closeFabMenu();
      return;
    }
    if (lootButton) {
      await handleLootAction(container);
      closeFabMenu();
    }
  });
  fabHandlersBound = true;
}

function closeFabMenu() {
  const actionsFab = document.querySelector('[data-actions-fab]');
  const actionsToggle = document.querySelector('[data-actions-toggle]');
  if (!actionsFab || !actionsFab.classList.contains('is-open')) return;
  actionsFab.classList.remove('is-open');
  actionsToggle?.setAttribute('aria-expanded', 'false');
}

function getHomeContext() {
  const state = getState();
  const { user, offline, characters, activeCharacterId } = state;
  const normalizedActiveId = normalizeCharacterId(activeCharacterId);
  const activeCharacter = characters.find((char) => normalizeCharacterId(char.id) === normalizedActiveId);
  return {
    activeCharacter,
    canEditCharacter: Boolean(user) && !offline
  };
}

async function handleLootAction(container) {
  const { activeCharacter } = getHomeContext();
  const state = getState();
  if (!activeCharacter) return;
  if (state.offline) {
    createToast('Loot disponibile solo online.', 'error');
    return;
  }
  const weightUnit = getWeightUnit(activeCharacter);
  const weightStep = weightUnit === 'kg' ? '0.1' : '1';
  const formData = await openFormModal({
    title: 'Aggiungi loot',
    submitLabel: 'Aggiungi',
    content: buildLootFields(weightStep)
  });
  if (!formData) return;
  try {
    await createItem({
      user_id: activeCharacter.user_id,
      character_id: activeCharacter.id,
      name: formData.get('name'),
      qty: Number(formData.get('qty')),
      weight: Number(formData.get('weight')),
      volume: Number(formData.get('volume')) || 0,
      value_cp: Number(formData.get('value_cp')),
      category: 'loot',
      equipable: false,
      equip_slot: null,
      equip_slots: [],
      sovrapponibile: false,
      is_magic: false,
      max_volume: null
    });
    createToast('Loot aggiunto');
    if (container) {
      renderHome(container);
    }
  } catch (error) {
    createToast('Errore loot', 'error');
  }
}

async function handleMoneyAction(direction, container) {
  const { activeCharacter, canEditCharacter } = getHomeContext();
  if (!activeCharacter) return;
  if (!canEditCharacter) {
    createToast('Azioni denaro disponibili solo con profilo online', 'error');
    return;
  }
  const state = getState();
  let wallet = state.cache.wallet;
  if (!wallet && !state.offline) {
    try {
      wallet = await fetchWallet(activeCharacter.id);
      updateCache('wallet', wallet);
      if (wallet) {
        await cacheSnapshot({ wallet });
      }
    } catch (error) {
      createToast('Errore caricamento wallet', 'error');
    }
  }
  const title = direction === 'pay' ? 'Paga monete' : 'Ricevi monete';
  const submitLabel = direction === 'pay' ? 'Paga' : 'Ricevi';
  const formData = await openFormModal({ title, submitLabel, content: moneyFields({ direction }) });
  if (!formData) return;
  if (!wallet) {
    wallet = {
      user_id: activeCharacter.user_id,
      character_id: activeCharacter.id,
      cp: 0,
      sp: 0,
      gp: 0,
      pp: 0
    };
  }
  const coin = formData.get('coin');
  const amount = Number(formData.get('amount') || 0);
  const delta = {
    cp: coin === 'cp' ? amount : 0,
    sp: coin === 'sp' ? amount : 0,
    gp: coin === 'gp' ? amount : 0,
    pp: coin === 'pp' ? amount : 0
  };
  const sign = direction === 'pay' ? -1 : 1;
  const signedDelta = Object.fromEntries(
    Object.entries(delta).map(([key, value]) => [key, value * sign])
  );
  const nextWallet = applyMoneyDelta(wallet, signedDelta);

  try {
    const saved = await upsertWallet({ ...nextWallet, user_id: wallet.user_id, character_id: wallet.character_id });
    await createTransaction({
      user_id: wallet.user_id,
      character_id: wallet.character_id,
      direction,
      amount: signedDelta,
      reason: formData.get('reason'),
      occurred_on: formData.get('occurred_on')
    });
    updateCache('wallet', saved);
    await cacheSnapshot({ wallet: saved });
    createToast('Wallet aggiornato');
    if (container) {
      renderHome(container);
    }
  } catch (error) {
    createToast('Errore aggiornamento denaro', 'error');
  }
}

function buildSkillRollOptions(character, items = []) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const skillStates = data.skills || {};
  const skillMasteryStates = data.skill_mastery || {};
  const hasHeavyArmor = (items || []).some((item) => item.category === 'armor'
    && item.armor_type === 'heavy'
    && item.equipable
    && getEquipSlots(item).length);
  return skillList.map((skill) => {
    const proficient = Boolean(skillStates[skill.key]);
    const mastery = Boolean(skillMasteryStates[skill.key]);
    const total = calculateSkillModifier(abilities[skill.ability], proficiencyBonus, proficient ? (mastery ? 2 : 1) : 0);
    const modifierValue = total ?? 0;
    const isStealthHeavy = skill.key === 'stealth' && hasHeavyArmor;
    return {
      value: skill.key,
      label: `${skill.label} (${formatSigned(total)})`,
      shortLabel: skill.label,
      modifier: modifierValue,
      rollMode: isStealthHeavy ? 'disadvantage' : null,
      rollModeReason: isStealthHeavy ? 'Svantaggio automatico: armatura pesante su Furtività.' : null
    };
  });
}

function buildSavingThrowRollOptions(character) {
  const data = character.data || {};
  const abilities = data.abilities || {};
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus);
  const savingStates = data.saving_throws || {};
  return savingThrowList.map((save) => {
    const proficient = Boolean(savingStates[save.key]);
    const total = calculateSkillModifier(abilities[save.key], proficiencyBonus, proficient ? 1 : 0);
    const modifierValue = total ?? 0;
    return {
      value: save.key,
      label: `${save.label} (${formatSigned(total)})`,
      shortLabel: abilityShortLabel[save.key] || save.label,
      modifier: modifierValue
    };
  });
}

function buildAttackRollOptions(character, items = []) {
  const data = character.data || {};
  const attackBonusMelee = Number(data.attack_bonus_melee ?? data.attack_bonus) || 0;
  const attackBonusRanged = Number(data.attack_bonus_ranged ?? data.attack_bonus) || 0;
  const equippedWeapons = (items || []).filter((item) => item.category === 'weapon' && item.equipable && getEquipSlots(item).length);
  const proficiencyBonus = normalizeNumber(data.proficiency_bonus) ?? 0;
  const proficiencies = data.proficiencies || {};
  const options = equippedWeapons.map((weapon) => {
    const weaponRange = weapon.weapon_range || (weapon.range_normal ? 'ranged' : 'melee');
    const attackAbility = weapon.attack_ability || (weaponRange === 'ranged' ? 'dex' : 'str');
    const abilityMod = getAbilityModifier(data.abilities?.[attackAbility]) ?? 0;
    const proficient = weapon.weapon_type === 'simple'
      ? Boolean(proficiencies.weapon_simple)
      : weapon.weapon_type === 'martial'
        ? Boolean(proficiencies.weapon_martial)
        : false;
    const weaponProficiencyBonus = proficient ? proficiencyBonus : 0;
    const attackBonus = weaponRange === 'ranged' ? attackBonusRanged : attackBonusMelee;
    const attackTotal = abilityMod + weaponProficiencyBonus + (Number(weapon.attack_modifier) || 0) + attackBonus;
    return {
      value: `weapon:${weapon.id ?? weapon.name}`,
      label: `${weapon.name} (${formatSigned(attackTotal)})`,
      shortLabel: weapon.name,
      modifier: attackTotal
    };
  });

  const spellcasting = data.spellcasting || {};
  const spellAbilityKey = spellcasting.ability;
  const spellAbilityScore = spellAbilityKey ? data.abilities?.[spellAbilityKey] : null;
  const spellAbilityMod = getAbilityModifier(spellAbilityScore);
  const spellAttackBonus = spellAbilityMod === null || proficiencyBonus === null
    ? null
    : spellAbilityMod + proficiencyBonus;
  const spells = Array.isArray(data.spells) ? data.spells : [];
  const cantripAttacks = spells.filter((spell) => {
    const isCantrip = spell.kind === 'cantrip' || Number(spell.level) === 0;
    return isCantrip && spell.attack_roll && spell.damage_die;
  });
  if (spellAbilityKey && spellAttackBonus !== null) {
    cantripAttacks.forEach((spell) => {
      options.push({
        value: `spell:${spell.id}`,
        label: `${spell.name} (${formatSigned(spellAttackBonus)})`,
        shortLabel: spell.name,
        modifier: spellAttackBonus
      });
    });
  }

  return options;
}

function handleDiceAction(type) {
  const { activeCharacter, canEditCharacter } = getHomeContext();
  const items = getState().cache.items || [];
  const allowInspiration = Boolean(activeCharacter?.data?.inspiration) && canEditCharacter;
  const weakPoints = Number(activeCharacter?.data?.hp?.weak_points) || 0;
  const onConsumeInspiration = allowInspiration && activeCharacter
    ? async () => {
      const currentData = activeCharacter.data || {};
      if (!currentData.inspiration) return;
      await saveCharacterData(
        activeCharacter,
        { ...currentData, inspiration: false },
        'Ispirazione consumata',
        lastHomeContainer ? () => renderHome(lastHomeContainer) : null
      );
    }
    : null;
  const configs = {
    'saving-throws': {
      title: 'Tiro Salvezza',
      mode: 'd20',
      rollType: 'TS',
      selection: activeCharacter
        ? { label: 'Tiro salvezza', options: buildSavingThrowRollOptions(activeCharacter) }
        : null
    },
    skills: {
      title: 'Tiro Abilità',
      mode: 'd20',
      rollType: 'TA',
      selection: activeCharacter
        ? { label: 'Abilità', options: buildSkillRollOptions(activeCharacter, items) }
        : null
    },
    'attack-roll': {
      title: 'Tiro per Colpire',
      mode: 'd20',
      rollType: 'TC',
      selection: activeCharacter
        ? { label: 'Attacco', options: buildAttackRollOptions(activeCharacter, items) }
        : null
    },
    roller: { title: 'Lancia Dadi generico', mode: 'generic', rollType: 'GEN' }
  };
  const config = configs[type] ?? { title: 'Lancia dadi', mode: 'generic' };
  openDiceRollerModal({
    ...config,
    allowInspiration,
    onConsumeInspiration,
    weakPoints
  });
}

async function handleRestAction(resetOn, container) {
  const { activeCharacter } = getHomeContext();
  if (!activeCharacter) return;
  const shouldRest = await openConfirmModal({ message: 'Confermi il riposo?' });
  if (!shouldRest) return;
  try {
    await updateResourcesReset(activeCharacter.id, resetOn);
    const toastLabel = resetOn === 'long_rest' ? 'Riposo lungo completato' : 'Riposo breve completato';
    createToast(toastLabel);
    const refreshed = await fetchResources(activeCharacter.id);
    updateCache('resources', refreshed);
    await cacheSnapshot({ resources: refreshed });
    const nextData = applyRestRecovery(activeCharacter.data, resetOn);
    if (nextData) {
      await saveCharacterData(activeCharacter, nextData, null, container ? () => renderHome(container) : null);
    } else if (container) {
      renderHome(container);
    }
    if (resetOn === 'long_rest') {
      const refreshed = getState().characters.find((char) => char.id === activeCharacter.id);
      if (refreshed?.data?.spellcasting?.can_prepare) {
        await openPreparedSpellsModal(refreshed, container ? () => renderHome(container) : null);
      }
    }
  } catch (error) {
    createToast('Errore aggiornamento risorse', 'error');
  }
}

async function handleHpAction(action, container) {
  const { activeCharacter, canEditCharacter } = getHomeContext();
  if (!activeCharacter) return;
  if (!canEditCharacter) {
    createToast('Azioni HP disponibili solo con profilo online', 'error');
    return;
  }
  const title = action === 'heal' ? 'Cura PF' : 'Infliggi danno';
  const submitLabel = action === 'heal' ? 'Cura' : 'Danno';
  const formData = await openFormModal({
    title,
    submitLabel,
    content: buildHpShortcutFields(activeCharacter, {
      allowHitDice: action === 'heal',
      allowTempHp: action === 'heal',
      allowMaxOverride: action === 'damage'
    })
  });
  if (!formData) return;
  const useHitDice = formData.has('use_hit_dice');
  const useTempHp = formData.has('temp_hp');
  const hitDice = activeCharacter.data?.hit_dice || {};
  const abilities = activeCharacter.data?.abilities || {};
  const hitDiceUsed = Number(hitDice.used) || 0;
  const hitDiceMax = Number(hitDice.max) || 0;
  const hitDiceSides = getHitDiceSides(hitDice.die);
  const diceCount = Math.max(Number(formData.get('hit_dice_count')) || 1, 1);
  let amount = Number(formData.get('amount'));

  if (action === 'heal' && useHitDice) {
    if (!hitDiceSides) {
      createToast('Configura un dado vita valido', 'error');
      return;
    }
    if (hitDiceUsed >= hitDiceMax) {
      createToast('Nessun dado vita disponibile', 'error');
      return;
    }
    const remaining = Math.max(hitDiceMax - hitDiceUsed, 0);
    if (diceCount > remaining) {
      createToast(`Hai solo ${remaining} dadi vita disponibili`, 'error');
      return;
    }
    const conMod = getAbilityModifier(abilities.con) ?? 0;
    const rolls = Array.from({ length: diceCount }, () => rollDie(hitDiceSides));
    const totalRoll = rolls.reduce((sum, roll) => sum + roll, 0);
    amount = Math.max(totalRoll + conMod * diceCount, 1);
  }

  if (!amount || amount <= 0) {
    createToast('Inserisci un valore valido', 'error');
    return;
  }
  const currentHp = Number(activeCharacter.data?.hp?.current) || 0;
  const currentTempHp = Number(activeCharacter.data?.hp?.temp) || 0;
  const maxHp = activeCharacter.data?.hp?.max;
  const maxOverrideRaw = formData.get('hp_max_override');
  const maxOverrideValue = maxOverrideRaw === null || maxOverrideRaw === '' ? null : Number(maxOverrideRaw);
  if (action === 'damage' && maxOverrideValue !== null && (!Number.isFinite(maxOverrideValue) || maxOverrideValue <= 0)) {
    createToast('Inserisci un massimo PF valido', 'error');
    return;
  }
  let nextCurrent = currentHp;
  let nextTemp = currentTempHp;
  if (action === 'heal' && useTempHp) {
    nextTemp = currentTempHp + amount;
  } else if (action === 'heal') {
    nextCurrent = currentHp + amount;
  } else {
    const absorbed = Math.min(currentTempHp, amount);
    nextTemp = currentTempHp - absorbed;
    const remainingDamage = amount - absorbed;
    nextCurrent = Math.max(currentHp - remainingDamage, 0);
  }
  const effectiveMax = maxOverrideValue !== null && maxOverrideValue !== undefined
    ? maxOverrideValue
    : maxHp;
  const adjusted = effectiveMax !== null && effectiveMax !== undefined
    ? Math.min(nextCurrent, Number(effectiveMax))
    : nextCurrent;
  const nextHitDice = action === 'heal' && useHitDice
    ? {
      ...hitDice,
      used: Math.min(hitDiceUsed + diceCount, hitDiceMax)
    }
    : hitDice;
  const message = action === 'heal'
    ? `${useTempHp ? 'HP temporanei +' : 'PF curati +'}${amount}${useHitDice ? ` (${diceCount}d${hitDiceSides})` : ''}`
    : `Danno ${amount}`;
  await saveCharacterData(activeCharacter, {
    ...activeCharacter.data,
    hp: {
      ...activeCharacter.data?.hp,
      current: adjusted,
      temp: nextTemp,
      max: maxOverrideValue !== null && maxOverrideValue !== undefined ? maxOverrideValue : maxHp
    },
    hit_dice: nextHitDice
  }, message, container ? () => renderHome(container) : null);
}

function openDiceRollerModal({
  title,
  mode,
  selection = null,
  allowInspiration = false,
  onConsumeInspiration = null,
  rollType = null,
  weakPoints = 0
}) {
  openDiceOverlay({
    keepOpen: true,
    title,
    mode,
    selection,
    allowInspiration,
    onConsumeInspiration,
    rollType,
    weakPoints
  });
}

function buildHpShortcutFields(
  character,
  {
    allowHitDice = true,
    allowTempHp = false,
    allowMaxOverride = false
  } = {}
) {
  const wrapper = document.createElement('div');
  const amountField = buildInput({ label: 'Valore', name: 'amount', type: 'number', value: '1' });
  const amountInput = amountField.querySelector('input');
  if (amountInput) {
    amountInput.min = '1';
    amountInput.required = true;
  }
  wrapper.appendChild(amountField);

  if (allowTempHp) {
    const tempHpField = document.createElement('label');
    tempHpField.className = 'checkbox';
    tempHpField.innerHTML = `
      <input type="checkbox" name="temp_hp" />
      <span>HP temporanei</span>
    `;
    wrapper.appendChild(tempHpField);
  }

  if (!allowHitDice) {
    if (allowMaxOverride) {
      const maxHpField = buildInput({
        label: 'Nuovo massimo PF',
        name: 'hp_max_override',
        type: 'number',
        value: ''
      });
      const maxInput = maxHpField.querySelector('input');
      if (maxInput) {
        maxInput.min = '1';
      }
      wrapper.appendChild(maxHpField);
    }
    return wrapper;
  }

  const hitDice = character?.data?.hit_dice || {};
  const hitDiceUsed = Number(hitDice.used) || 0;
  const hitDiceMax = Number(hitDice.max) || 0;
  const remaining = Math.max(hitDiceMax - hitDiceUsed, 0);
  const hitDiceSides = getHitDiceSides(hitDice.die);
  const canUse = remaining > 0 && hitDiceSides;

  const hitDiceField = document.createElement('label');
  hitDiceField.className = 'checkbox';
  const hitDiceLabel = hitDice.die ? `${hitDice.die}` : 'dado vita';
  hitDiceField.innerHTML = `
    <input type="checkbox" name="use_hit_dice" ${canUse ? '' : 'disabled'} />
    <span>Usa dado vita (${hitDiceLabel}) · rimasti ${remaining}/${hitDiceMax || '-'}</span>
  `;
  wrapper.appendChild(hitDiceField);

  const hitDiceCountField = document.createElement('label');
  hitDiceCountField.className = 'field hit-dice-count';
  hitDiceCountField.innerHTML = `
    <span>Numero dadi vita</span>
    <input type="number" name="hit_dice_count" min="1" max="${remaining}" value="1" />
  `;
  wrapper.appendChild(hitDiceCountField);

  if (!canUse) {
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = 'Nessun dado vita disponibile o configurato.';
    wrapper.appendChild(hint);
  }

  const checkbox = hitDiceField.querySelector('input');
  const countInput = hitDiceCountField.querySelector('input');
  if (countInput) {
    countInput.required = false;
  }

  const syncState = () => {
    const useDice = checkbox?.checked;
    if (!amountInput) return;
    amountInput.disabled = Boolean(useDice);
    amountInput.required = !useDice;
    if (useDice) {
      amountInput.value = '';
    } else if (!amountInput.value) {
      amountInput.value = '1';
    }
    if (countInput) {
      countInput.disabled = !useDice;
      countInput.required = Boolean(useDice);
      if (!useDice) {
        countInput.value = '1';
      }
    }
    hitDiceCountField.style.display = useDice ? 'grid' : 'none';
  };
  checkbox?.addEventListener('change', syncState);
  syncState();

  return wrapper;
}
