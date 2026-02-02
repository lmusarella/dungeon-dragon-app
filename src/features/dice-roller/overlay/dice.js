let overlayEl = null;

function buildDiceMarkup() {
  return `
    <div id="diceRoller"></div>
    <main id="diceRollerUI">
      <div class="top_field" hidden>
        <input type="text" id="textInput" spellcheck="false" inputmode="none" virtualkeyboardpolicy="manual"
               value="1d20"/>
      </div>
      <div id="diceLimit" style="display:none">Wow that's a lot of dice! <br>[Limit: 20]</div>    
      <div id="numPad" class="center_field" style="display:none">
        <table class="numPad">
          <tr><td onclick="main.input('del')" colspan="2">del</td><td onclick="main.input('bksp')" colspan="2">bksp</td></tr>
          <tr><td onclick="main.input('7')">7</td><td onclick="main.input('8')">8</td><td onclick="main.input('9')">9</td><td onclick="main.input('+')" rowspan="2">+</td></tr>
          <tr><td onclick="main.input('4')">4</td><td onclick="main.input('5')">5</td><td onclick="main.input('6')">6</td></tr>
          <tr><td onclick="main.input('1')">1</td><td onclick="main.input('2')">2</td><td onclick="main.input('3')">3</td><td onclick="main.input('-')" rowspan="2">-</td></tr>
          <tr><td onclick="main.input('0')" colspan="2">0</td><td onclick="main.input('d')">d</td></tr>
        </table>
        <button onclick="main.clearInput()">CLEAR</button>
        <button onclick="main.setInput()">OK</button>
      </div>
      <div class="bottom_field" hidden><span id="result"></span></div>
    </main>
  `;
}

function buildOverlayMarkup() {
  return `
  <div class="diceov-backdrop" data-close></div>
  <div class="diceov-stage" role="dialog" aria-modal="true" aria-label="Lancio dadi">
    <button class="diceov-close" data-close aria-label="Chiudi" hidden>×</button>
    <section class="diceov-panel">
      <header class="diceov-header">
        <div>      
          <p class="diceov-eyebrow" data-dice-title>Lancia dadi</h3>
        </div>
      </header>
      <div class="diceov-controls">   
        <div class="diceov-control diceov-control--row" data-modifier-home>
         <div class="diceov-control" data-dice-control="d20">
          <label class="diceov-label" for="dice-roll-mode">Modalità</label>
          <select id="dice-roll-mode" name="dice-roll-mode">
            <option value="normal" selected>Normale</option>
            <option value="advantage">Vantaggio</option>
            <option value="disadvantage">Svantaggio</option>
          </select>
        </div>
          <div class="diceov-control" data-dice-select hidden>
            <label class="diceov-label" for="dice-roll-select" data-dice-select-label>Seleziona</label>
            <select id="dice-roll-select" name="dice-roll-select"></select>
          </div>
          <div class="diceov-field diceov-field--modifier">
            <label class="diceov-label" for="dice-modifier">Mod</label>
            <input id="dice-modifier" type="number" name="dice-modifier" value="0" step="1" />
          </div>
          <div class="diceov-control" data-dice-buff hidden>
            <label class="diceov-label" for="dice-buff">Buff/Debuff</label>
            <select id="dice-buff" name="dice-buff">
              <option value="none" selected>Nessuno</option>
              <option value="plus-d4">+d4</option>
              <option value="plus-d6">+d6</option>
              <option value="minus-d4">-d4</option>
              <option value="minus-d6">-d6</option>
            </select>
          </div>
           <div class="diceov-control" data-dice-control="d20">
          <div class="diceov-inspiration" data-dice-inspiration>
            <span class="diceov-label">Ispirazione</span>
            <label class="diceov-toggle">
              <input id="dice-inspiration" type="checkbox" name="dice-inspiration" />
              <span class="diceov-toggle-track" aria-hidden="true"></span>
            </label>
          </div>
        </div>
         <p class="diceov-warning" data-inspiration-warning hidden>
              Attenzione: userai il punto ispirazione su questo tiro.
            </p>
        </div>
       
        <div class="diceov-control" data-dice-control="generic">
          <div class="diceov-generic-header">
            <span class="diceov-label">Dadi</span>
            <label class="diceov-label diceov-label--inline" for="dice-notation">Notazione dadi</label>
          </div>
          <div class="diceov-generic-row">
            <input type="number" name="dice-count" min="1" value="1" aria-label="Numero dadi" />
            <select name="dice-type" aria-label="Tipo dado">
              <option value="d4">d4</option>
              <option value="d6">d6</option>
              <option value="d8">d8</option>
              <option value="d10">d10</option>
              <option value="d12">d12</option>
              <option value="d20" selected>d20</option>
              <option value="d100">d100</option>
            </select>
            <input id="dice-notation" class="diceov-generic-notation" type="text" name="dice-notation" value="1d20" spellcheck="false" />
            <div class="diceov-field diceov-field--modifier" data-modifier-slot></div>
          </div>
          <p class="diceov-hint">Puoi combinare dadi diversi (es. 2d6+1d4).</p>
        </div>
      </div>
      <div class="diceov-results">
        <div class="diceov-result diceov-result--full">
          <p class="diceov-result-label">Risultato</p>
          <p class="diceov-result-value" data-dice-result>—</p>
          <p class="diceov-result-detail" data-dice-detail>Lancia i dadi per vedere il totale.</p>
        </div>
      </div>
    </section>
    ${buildDiceMarkup()}
    <section class="diceov-history-accordion" data-history-accordion>
      <button class="diceov-history-toggle" type="button" data-history-toggle aria-expanded="false">
        <span>Storico tiri</span>
        <span class="diceov-history-toggle-icon" aria-hidden="true">▾</span>
      </button>
      <div class="diceov-history-panel" data-dice-history-panel hidden>
        <div class="diceov-history-list" data-dice-history></div>
      </div>
    </section>
  </div>`;
}

export function createDiceRollerEmbed() {
  const wrapper = document.createElement('div');
  wrapper.className = 'dice-roller-embed';
  wrapper.innerHTML = buildDiceMarkup();
  return wrapper;
}

function parseLastInt(text) {
  const m = String(text).match(/\d+/g);
  return m ? parseInt(m[m.length - 1], 10) : null;
}

const HISTORY_KEY = 'diceRollHistory';
const HISTORY_LIMIT = 12;

function loadHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch { }
}

function formatHistoryDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('it-IT', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return timestamp;
  }
}

function formatModifier(value) {
  if (!value) return '+0';
  return value > 0 ? `+${value}` : `${value}`;
}

function getRollMode(overlay) {
  const selected = overlay.querySelector('select[name="dice-roll-mode"]');
  return selected?.value ?? 'normal';
}

function updateDiceInput(overlay, value) {
  const input = overlay.querySelector('#textInput');
  if (input) {
    input.value = value;
    if (window.main && typeof window.main.setInput === 'function') {
      window.main.setInput();
    }
  }
}

function buildGenericNotation(overlay) {
  const count = Math.max(Number(overlay.querySelector('[name="dice-count"]')?.value) || 1, 1);
  const type = overlay.querySelector('[name="dice-type"]')?.value || 'd20';
  return `${count}${type}`;
}

function syncGenericInputsFromNotation(overlay, value) {
  const match = String(value || '').trim().match(/^(\d+)\s*d\s*(\d+)$/i);
  if (!match) return;
  const countInput = overlay.querySelector('[name="dice-count"]');
  const typeInput = overlay.querySelector('[name="dice-type"]');
  if (countInput) countInput.value = match[1];
  if (typeInput) typeInput.value = `d${match[2]}`;
}

function setOverlayMode(overlay, mode) {
  overlay.dataset.diceMode = mode;
  overlay.querySelectorAll('[data-dice-control]').forEach((section) => {
    const shouldShow = section.dataset.diceControl === mode || section.dataset.diceControl === 'd20' && mode === 'd20';
    section.toggleAttribute('hidden', !shouldShow);
  });
}

export function openDiceOverlay({
  sides = 20,
  keepOpen = false,
  title = 'Lancia dadi',
  mode = 'generic',
  notation = null,
  modifier = null,
  selection = null,
  allowInspiration = false,
  onConsumeInspiration = null,
  rollType = null
} = {}) {
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'dice-overlay';
    overlayEl.innerHTML = buildOverlayMarkup();
    document.body.appendChild(overlayEl);

    if (window.main && typeof window.main.init === 'function') {
      window.main.init();
    }
    if (window.main && typeof window.main.setInput === 'function') {
      window.main.setInput();
    }
    overlayEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeDiceOverlay();
    });
    document.addEventListener('keydown', escClose, true);
  }

  try {
    const res = overlayEl.querySelector('#result');
    if (res) res.textContent = '—';
    const lim = overlayEl.querySelector('#diceLimit');
    if (lim) lim.style.display = 'none';
  } catch { }

  if (window.main && typeof window.main.clearDice === 'function') {
    window.main.clearDice();
  }

  overlayEl.querySelector('[data-dice-title]')?.replaceChildren(document.createTextNode(title));
  const overlayMode = mode === 'generic' ? 'generic' : 'd20';
  setOverlayMode(overlayEl, overlayMode);

  const inspirationInput = overlayEl.querySelector('input[name="dice-inspiration"]');
  const inspirationField = overlayEl.querySelector('[data-dice-inspiration]');
  const inspirationWarning = overlayEl.querySelector('[data-inspiration-warning]');
  const rollModeInput = overlayEl.querySelector('select[name="dice-roll-mode"]');
  const modifierInput = overlayEl.querySelector('input[name="dice-modifier"]');
  const modifierField = modifierInput?.closest('.diceov-field--modifier');
  const modifierSlot = overlayEl.querySelector('[data-modifier-slot]');
  const modifierHome = overlayEl.querySelector('[data-modifier-home]') ?? modifierField?.parentElement ?? null;
  const notationInput = overlayEl.querySelector('input[name="dice-notation"]');
  const selectWrapper = overlayEl.querySelector('[data-dice-select]');
  const selectLabel = overlayEl.querySelector('[data-dice-select-label]');
  const selectInput = overlayEl.querySelector('select[name="dice-roll-select"]');
  const resultValue = overlayEl.querySelector('[data-dice-result]');
  const resultDetail = overlayEl.querySelector('[data-dice-detail]');
  const buffWrapper = overlayEl.querySelector('[data-dice-buff]');
  const buffSelect = overlayEl.querySelector('select[name="dice-buff"]');
  const stage = overlayEl.querySelector('.diceov-stage');
  const historyAccordion = overlayEl.querySelector('[data-history-accordion]');
  const historyToggle = overlayEl.querySelector('[data-history-toggle]');
  const historyPanel = overlayEl.querySelector('[data-dice-history-panel]');
  const historyList = overlayEl.querySelector('[data-dice-history]');

  const state = {
    lastRoll: null,
    lastBuff: null,
    inspirationAvailable: Boolean(allowInspiration),
    inspirationConsumed: false,
    selectionOptions: Array.isArray(selection?.options) ? selection.options : [],
    history: loadHistory()
  };

  function placeModifierField(isGeneric) {
    if (!modifierField) return;
    if (isGeneric && modifierSlot) {
      if (!modifierSlot.contains(modifierField)) {
        modifierSlot.appendChild(modifierField);
      }
      return;
    }
    if (!isGeneric && modifierHome) {
      const anchor = buffWrapper && modifierHome.contains(buffWrapper) ? buffWrapper : null;
      if (anchor) {
        modifierHome.insertBefore(modifierField, anchor);
        return;
      }
      modifierHome.appendChild(modifierField);
    }
  }

  function resetResult(label = '—', detail = 'Lancia i dadi per vedere il totale.') {
    if (resultValue) resultValue.textContent = label;
    if (resultDetail) resultDetail.textContent = detail;
    state.lastRoll = null;
  }

  function renderHistory() {
    if (!historyList) return;
    if (!state.history.length) {
      historyList.innerHTML = '<p class="diceov-history-empty">Nessun tiro ancora.</p>';
      return;
    }
    historyList.innerHTML = state.history
      .map((entry) => `
        <div class="diceov-history-row">
          <div class="diceov-history-type diceov-history-type--${String(entry.type || 'gen').toLowerCase()}">
            <span class="diceov-history-type-code">${entry.type || '—'}</span>
            ${entry.subtype ? `<span class="diceov-history-subtype">${entry.subtype}</span>` : ''}
            ${entry.inspired ? '<span class="diceov-history-flag">Isp.</span>' : ''}
          </div>
          <span class="diceov-history-total">${entry.total ?? '—'}</span>
          <span class="diceov-history-date">${formatHistoryDate(entry.timestamp)}</span>
        </div>
      `)
      .join('');
  }

  function addHistoryEntry(entry) {
    state.history = [entry, ...state.history].slice(0, HISTORY_LIMIT);
    saveHistory(state.history);
    renderHistory();
  }

  function updateInspiration() {
    if (!rollModeInput) return;
    const inspired = Boolean(inspirationInput?.checked);
    if (inspired) rollModeInput.value = 'advantage';
    rollModeInput.disabled = inspired;
    if (inspirationWarning) inspirationWarning.toggleAttribute('hidden', !inspired);
  }

  function setInspirationAvailability(available) {
    state.inspirationAvailable = Boolean(available);
    if (inspirationField) inspirationField.toggleAttribute('hidden', !state.inspirationAvailable);
    if (inspirationInput) {
      inspirationInput.disabled = !state.inspirationAvailable;
      if (!state.inspirationAvailable) inspirationInput.checked = false;
    }
    if (!state.inspirationAvailable && rollModeInput) {
      rollModeInput.disabled = false;
    }
    if (!state.inspirationAvailable && inspirationWarning) {
      inspirationWarning.setAttribute('hidden', '');
    }
  }

  function setSelectionOptions() {
    if (!selectWrapper || !selectInput) return;
    if (!state.selectionOptions.length) {
      selectWrapper.setAttribute('hidden', '');
      selectInput.innerHTML = '';
      return;
    }
    selectWrapper.removeAttribute('hidden');
    if (selectLabel) selectLabel.textContent = selection?.label || 'Seleziona';
    selectInput.innerHTML = state.selectionOptions
      .map((option) => `<option value="${option.value}">${option.label}</option>`)
      .join('');
    const desiredValue = selection?.value ?? state.selectionOptions[0]?.value;
    if (desiredValue !== undefined) selectInput.value = desiredValue;
    const selected = state.selectionOptions.find((option) => option.value === selectInput.value);
    if (selected && modifierInput) {
      modifierInput.value = Number(selected.modifier) || 0;
    }
  }

  function setBuffVisibility() {
    if (!buffWrapper || !buffSelect) return;
    const supported = ['TS', 'TA', 'TC'].includes(rollType);
    buffWrapper.toggleAttribute('hidden', !supported);
    if (!supported) {
      buffSelect.value = 'none';
      state.lastBuff = null;
    }
  }

  function getBuffConfig() {
    if (!buffSelect || buffWrapper?.hasAttribute('hidden')) return null;
    const choice = buffSelect.value;
    if (choice === 'none') return null;
    const sides = choice.endsWith('d6') ? 6 : 4;
    const isPositive = choice.startsWith('plus');
    const label = `${isPositive ? '+' : '-'}d${sides}`;
    return { choice, sides, label, sign: isPositive ? 1 : -1 };
  }

  function getD20RollInfo(notation) {
    const rolls = notation.result || [];
    const rollMode = getRollMode(overlayEl);
    const baseCount = rollMode === 'normal' ? 1 : 2;
    const baseRolls = rolls.slice(0, baseCount);
    const buffConfig = getBuffConfig();
    let buff = null;
    if (buffConfig && rolls.length > baseCount) {
      const buffRoll = rolls[baseCount];
      if (typeof buffRoll === 'number') {
        buff = { ...buffConfig, roll: buffRoll, delta: buffConfig.sign * buffRoll };
      }
    }
    const picked = baseRolls.length
      ? rollMode === 'advantage'
        ? Math.max(...baseRolls)
        : rollMode === 'disadvantage'
          ? Math.min(...baseRolls)
          : baseRolls[0]
      : null;
    return { rollMode, baseRolls, picked, buff };
  }

  function setHistoryOpen(open) {
    if (!historyAccordion || !historyToggle || !historyPanel) return;
    historyAccordion.classList.toggle('is-open', open);
    historyToggle.setAttribute('aria-expanded', String(open));
    historyPanel.toggleAttribute('hidden', !open);
    stage?.classList.toggle('diceov-stage--history-open', open);
    if (open) {
      const header = overlayEl.querySelector('.diceov-header');
      if (header && stage) {
        const offset = Math.max(
          header.getBoundingClientRect().bottom - stage.getBoundingClientRect().top,
          0
        );
        historyAccordion.style.setProperty('--diceov-history-offset', `${offset}px`);
      }
    }
  }

  function getSelectionLabel() {
    if (!selectInput) return null;
    const selected = state.selectionOptions.find((option) => option.value === selectInput.value);
    if (!selected) return null;
    const rawLabel = selected.shortLabel || selected.label || '';
    return rawLabel.replace(/\s*\([^)]*\)\s*$/, '').trim() || null;
  }

  function updateNotationFromMode() {
    if (mode !== 'generic') {
      const rollMode = getRollMode(overlayEl);
      const diceCount = rollMode === 'normal' ? 1 : 2;
      const buffConfig = getBuffConfig();
      const buffNotation = buffConfig ? `+1d${buffConfig.sides}` : '';
      updateDiceInput(overlayEl, `${diceCount}d${sides}${buffNotation}`);
      resetResult();
    }
  }

  function updateNotationFromGeneric() {
    const notation = notationInput?.value?.trim();
    const value = notation || buildGenericNotation(overlayEl);
    updateDiceInput(overlayEl, value);
    resetResult();
  }

  function updateModifier() {
    if (state.lastRoll) renderRollResult(state.lastRoll);
  }

  async function consumeInspiration() {
    if (!state.inspirationAvailable || state.inspirationConsumed) return;
    if (!inspirationInput?.checked) return;
    state.inspirationConsumed = true;
    setInspirationAvailability(false);
    if (typeof onConsumeInspiration === 'function') {
      await onConsumeInspiration();
    }
  }

  function renderRollResult(notation) {
    const modifier = Number(modifierInput?.value) || 0;
    if (mode !== 'generic') {
      const info = getD20RollInfo(notation);
      state.lastBuff = info.buff;
      if (!info.baseRolls.length) {
        resetResult();
        return;
      }
      const buffDelta = info.buff?.delta || 0;
      const total = (info.picked ?? 0) + modifier + buffDelta;
      const rollLabel = info.rollMode === 'advantage'
        ? 'Vantaggio'
        : info.rollMode === 'disadvantage'
          ? 'Svantaggio'
          : 'Normale';
      const rollsLabel = info.baseRolls.join(', ');
      if (resultValue) resultValue.textContent = `${total}`;
      if (resultDetail) {
        const selection = info.baseRolls.length > 1 ? ` (selezionato ${info.picked})` : '';
        const pieces = [`${rollLabel}: ${rollsLabel}${selection}`, `Mod ${formatModifier(modifier)}`];
        if (info.buff) {
          pieces.push(
            `${info.buff.label} ${formatModifier(info.buff.delta)} (d${info.buff.sides}: ${info.buff.roll})`
          );
        }
        resultDetail.textContent = pieces.join(' · ');
      }
      return;
    }

    const rolls = notation.result || [];
    const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
    const constant = Number(notation.constant) || 0;
    const buffDelta = state.lastBuff?.delta || 0;
    const total = diceTotal + constant + modifier + buffDelta;
    const rollDetail = rolls.length ? `Dadi: ${rolls.join(', ')}` : 'Dadi: —';
    if (resultValue) resultValue.textContent = `${total}`;
    if (resultDetail) {
      const pieces = [rollDetail];
      if (constant) pieces.push(`Costante ${formatModifier(constant)}`);
      if (modifier) pieces.push(`Mod ${formatModifier(modifier)}`);
      if (state.lastBuff) {
        pieces.push(
          `${state.lastBuff.label} ${formatModifier(state.lastBuff.delta)} (d${state.lastBuff.sides}: ${state.lastBuff.roll})`
        );
      }
      resultDetail.textContent = pieces.join(' · ');
    }
  }

  function summarizeRoll(notation) {
    const modifier = Number(modifierInput?.value) || 0;
    if (mode !== 'generic') {
      const info = getD20RollInfo(notation);
      state.lastBuff = info.buff;
      if (!info.baseRolls.length) return null;
      const buffDelta = info.buff?.delta || 0;
      return { value: info.picked, total: (info.picked ?? 0) + modifier + buffDelta };
    }
    const rolls = notation.result || [];
    const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
    const constant = Number(notation.constant) || 0;
    const buffDelta = state.lastBuff?.delta || 0;
    const value = diceTotal + constant;
    return { value, total: value + modifier + buffDelta };
  }

  if (inspirationInput) {
    inspirationInput.onchange = () => {
      updateInspiration();
      updateNotationFromMode();
    };
  }
  if (rollModeInput) rollModeInput.onchange = () => updateNotationFromMode();
  if (modifierInput) modifierInput.oninput = updateModifier;
  if (notationInput) notationInput.oninput = updateNotationFromGeneric;
  if (selectInput) {
    selectInput.onchange = () => {
      const selected = state.selectionOptions.find((option) => option.value === selectInput.value);
      if (selected && modifierInput) modifierInput.value = Number(selected.modifier) || 0;
      updateModifier();
    };
  }
  const diceCountInput = overlayEl.querySelector('[name="dice-count"]');
  if (diceCountInput) diceCountInput.oninput = () => {
    const notation = buildGenericNotation(overlayEl);
    if (notationInput) notationInput.value = notation;
    updateNotationFromGeneric();
  };
  const diceTypeInput = overlayEl.querySelector('[name="dice-type"]');
  if (diceTypeInput) diceTypeInput.onchange = () => {
    const notation = buildGenericNotation(overlayEl);
    if (notationInput) notationInput.value = notation;
    updateNotationFromGeneric();
  };
  if (buffSelect) {
    buffSelect.onchange = () => {
      state.lastBuff = null;
      updateNotationFromMode();
    };
  }
  if (historyToggle) {
    historyToggle.addEventListener('click', () => {
      const shouldOpen = !historyAccordion?.classList.contains('is-open');
      setHistoryOpen(shouldOpen);
    });
  }

  setSelectionOptions();
  setBuffVisibility();
  setInspirationAvailability(state.inspirationAvailable);
  updateInspiration();
  placeModifierField(overlayMode === 'generic');
  renderHistory();
  setHistoryOpen(false);

  overlayEl.removeAttribute('hidden');

  const hasExplicitModifier = modifier !== null && modifier !== undefined && modifier !== '';
  if (modifierInput && hasExplicitModifier && Number.isFinite(Number(modifier))) {
    modifierInput.value = Number(modifier);
  }

  if (mode === 'generic') {
    if (notationInput && notation) {
      notationInput.value = String(notation).trim();
      syncGenericInputsFromNotation(overlayEl, notationInput.value);
    }
    if (notationInput && !notationInput.value) notationInput.value = buildGenericNotation(overlayEl);
    updateNotationFromGeneric();
  } else {
    updateNotationFromMode();
  }

  const resultEl = overlayEl.querySelector('#result');
  let last = null;

  let resolveFn;
  const waitForRoll = new Promise((resolve) => {
    resolveFn = resolve;
  });

  const onMut = () => {
    const n = parseLastInt(resultEl?.textContent || '');
    if (n != null) {
      last = n;
      void consumeInspiration();
      if (!keepOpen) closeDiceOverlay();
      cleanup();
      resolveFn(n);
    }
  };

  const mo = resultEl ? new MutationObserver(onMut) : null;
  mo?.observe(resultEl, { childList: true, characterData: true, subtree: true });

  function cleanup() {
    try { mo?.disconnect(); } catch { }
  }

  const onRoll = (event) => {
    if (!overlayEl || overlayEl.hasAttribute('hidden')) return;
    state.lastRoll = event.detail || null;
    state.lastBuff = null;
    if (state.lastRoll) {
      void consumeInspiration();
      renderRollResult(state.lastRoll);
    }
    if (state.lastRoll) {
      const summary = summarizeRoll(state.lastRoll);
      if (summary) {
        addHistoryEntry({
          type: rollType || 'GEN',
          subtype: getSelectionLabel(),
          inspired: state.inspirationConsumed,
          value: summary.value,
          total: summary.total,
          timestamp: new Date().toISOString()
        });
      }
    }
  };
  window.addEventListener('diceRoll', onRoll);

  const closeRef = closeDiceOverlay;
  closeDiceOverlay = function () {
    cleanup();
    window.removeEventListener('diceRoll', onRoll);
    if (overlayEl) overlayEl.setAttribute('hidden', '');

    if (last == null) resolveFn?.(null);

    closeDiceOverlay = closeRef;
  };

  return {
    waitForRoll,
    close: () => { cleanup(); closeRef(); }
  };
}

function escClose(e) {
  if (e.key === 'Escape') closeDiceOverlay();
}

export function closeDiceOverlay() {
  if (!overlayEl) return;
  document.removeEventListener('keydown', escClose, true);
  overlayEl.setAttribute('hidden', '');
}
