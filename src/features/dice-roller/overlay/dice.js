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
      <div id="center_div" class="center_field">
        <div id="instructions" style="display: none"><p>Swipe to roll dice</p></div>
      </div>
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
          <p class="diceov-eyebrow">Lancio dadi</p>
          <h3 data-dice-title>Lancia dadi</h3>
        </div>
      </header>
      <div class="diceov-controls">
        <div class="diceov-control" data-dice-control="d20">
          <span class="diceov-label">Tipo di tiro</span>
          <div class="diceov-radio-group">
            <label><input type="radio" name="dice-roll-mode" value="normal" checked /> Normale</label>
            <label><input type="radio" name="dice-roll-mode" value="advantage" /> Vantaggio</label>
            <label><input type="radio" name="dice-roll-mode" value="disadvantage" /> Svantaggio</label>
          </div>
          <div class="diceov-inspiration" data-dice-inspiration>
            <label class="diceov-checkbox">
              <input type="checkbox" name="dice-inspiration" />
              Ispirazione (imposta vantaggio)
            </label>
            <p class="diceov-warning" data-inspiration-warning hidden>
              Attenzione: userai il punto ispirazione su questo tiro.
            </p>
          </div>
        </div>
        <div class="diceov-control" data-dice-control="d20" data-dice-select hidden>
          <label class="diceov-label" for="dice-roll-select" data-dice-select-label>Seleziona</label>
          <select id="dice-roll-select" name="dice-roll-select"></select>
        </div>
        <div class="diceov-control">
          <label class="diceov-label" for="dice-modifier">Modificatore</label>
          <input id="dice-modifier" type="number" name="dice-modifier" value="0" step="1" />
        </div>
        <div class="diceov-control" data-dice-control="generic">
          <span class="diceov-label">Dadi</span>
          <div class="diceov-generic-row">
            <input type="number" name="dice-count" min="1" value="1" />
            <select name="dice-type">
              <option value="d4">d4</option>
              <option value="d6">d6</option>
              <option value="d8">d8</option>
              <option value="d10">d10</option>
              <option value="d12">d12</option>
              <option value="d20" selected>d20</option>
              <option value="d100">d100</option>
            </select>
          </div>
          <label class="diceov-label" for="dice-notation">Notazione dadi</label>
          <input id="dice-notation" type="text" name="dice-notation" value="1d20" spellcheck="false" />
          <p class="diceov-hint">Puoi combinare dadi diversi (es. 2d6+1d4).</p>
        </div>
      </div>
      <div class="diceov-result">
        <p class="diceov-result-label">Risultato</p>
        <p class="diceov-result-value" data-dice-result>—</p>
        <p class="diceov-result-detail" data-dice-detail>Lancia i dadi per vedere il totale.</p>
      </div>
    </section>
    ${buildDiceMarkup()}
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

function formatModifier(value) {
  if (!value) return '+0';
  return value > 0 ? `+${value}` : `${value}`;
}

function getRollMode(overlay) {
  const selected = overlay.querySelector('input[name="dice-roll-mode"]:checked');
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
  selection = null,
  allowInspiration = false,
  onConsumeInspiration = null
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

  overlayEl.querySelector('[data-dice-title]')?.replaceChildren(document.createTextNode(title));
  setOverlayMode(overlayEl, mode === 'generic' ? 'generic' : 'd20');

  const inspirationInput = overlayEl.querySelector('input[name="dice-inspiration"]');
  const inspirationField = overlayEl.querySelector('[data-dice-inspiration]');
  const inspirationWarning = overlayEl.querySelector('[data-inspiration-warning]');
  const advantageInput = overlayEl.querySelector('input[value="advantage"]');
  const modifierInput = overlayEl.querySelector('input[name="dice-modifier"]');
  const notationInput = overlayEl.querySelector('input[name="dice-notation"]');
  const selectWrapper = overlayEl.querySelector('[data-dice-select]');
  const selectLabel = overlayEl.querySelector('[data-dice-select-label]');
  const selectInput = overlayEl.querySelector('select[name="dice-roll-select"]');
  const resultValue = overlayEl.querySelector('[data-dice-result]');
  const resultDetail = overlayEl.querySelector('[data-dice-detail]');

  const state = {
    lastRoll: null,
    inspirationAvailable: Boolean(allowInspiration),
    inspirationConsumed: false,
    selectionOptions: Array.isArray(selection?.options) ? selection.options : []
  };

  function resetResult(label = '—', detail = 'Lancia i dadi per vedere il totale.') {
    if (resultValue) resultValue.textContent = label;
    if (resultDetail) resultDetail.textContent = detail;
    state.lastRoll = null;
  }

  function updateInspiration() {
    if (!advantageInput) return;
    const inspired = Boolean(inspirationInput?.checked);
    if (inspired) advantageInput.checked = true;
    if (inspirationWarning) inspirationWarning.toggleAttribute('hidden', !inspired);
  }

  function setInspirationAvailability(available) {
    state.inspirationAvailable = Boolean(available);
    if (inspirationField) inspirationField.toggleAttribute('hidden', !state.inspirationAvailable);
    if (inspirationInput) {
      inspirationInput.disabled = !state.inspirationAvailable;
      if (!state.inspirationAvailable) inspirationInput.checked = false;
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

  function updateNotationFromMode() {
    if (mode !== 'generic') {
      const rollMode = getRollMode(overlayEl);
      const diceCount = rollMode === 'normal' ? 1 : 2;
      updateDiceInput(overlayEl, `${diceCount}d${sides}`);
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
      const rolls = notation.result || [];
      if (!rolls.length) {
        resetResult();
        return;
      }
      const rollMode = getRollMode(overlayEl);
      const picked = rollMode === 'advantage'
        ? Math.max(...rolls)
        : rollMode === 'disadvantage'
          ? Math.min(...rolls)
          : rolls[0];
      const total = picked + modifier;
      const rollLabel = rollMode === 'advantage'
        ? 'Vantaggio'
        : rollMode === 'disadvantage'
          ? 'Svantaggio'
          : 'Normale';
      const rollsLabel = rolls.join(', ');
      if (resultValue) resultValue.textContent = `${total}`;
      if (resultDetail) {
        const selection = rolls.length > 1 ? ` (selezionato ${picked})` : '';
        resultDetail.textContent = `${rollLabel}: ${rollsLabel}${selection} · Mod ${formatModifier(modifier)}`;
      }
      return;
    }

    const rolls = notation.result || [];
    const diceTotal = rolls.reduce((sum, value) => sum + value, 0);
    const constant = Number(notation.constant) || 0;
    const total = diceTotal + constant + modifier;
    const rollDetail = rolls.length ? `Dadi: ${rolls.join(', ')}` : 'Dadi: —';
    if (resultValue) resultValue.textContent = `${total}`;
    if (resultDetail) {
      const pieces = [rollDetail];
      if (constant) pieces.push(`Costante ${formatModifier(constant)}`);
      if (modifier) pieces.push(`Mod ${formatModifier(modifier)}`);
      resultDetail.textContent = pieces.join(' · ');
    }
  }

  if (inspirationInput) {
    inspirationInput.onchange = () => {
      updateInspiration();
      updateNotationFromMode();
    };
  }
  if (overlayEl) {
    overlayEl.querySelectorAll('input[name="dice-roll-mode"]').forEach((input) => {
      input.onchange = () => updateNotationFromMode();
    });
  }
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

  setSelectionOptions();
  setInspirationAvailability(state.inspirationAvailable);
  updateInspiration();

  overlayEl.removeAttribute('hidden');

  if (mode === 'generic') {
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
    if (state.lastRoll) renderRollResult(state.lastRoll);
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
