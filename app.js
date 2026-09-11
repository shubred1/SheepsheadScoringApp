  const STORAGE_KEY = "sheepshead_scorekeeper_data";
  const APP_VERSION = self.SHEEPSHEAD_APP_VERSION;
  const DATA_VERSION = 2;
  const MAX_PLAYERS = 7;

  let appData = null;
  let state = null;
  let modalMode = null;
  let editHandIndex = null;
  let editHandDraft = null;
  let shouldShowCompatibilityNotice = false;
  let shouldOpenNewGameOnFirstRun = false;

  function createId(prefix) {
    const id = crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${id}`;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyPlayers() {
    return new Array(MAX_PLAYERS).fill("");
  }

  function createGame(overrides = {}) {
    const timestamp = nowIso();
    return {
      id: createId("game"),
      name: "Game",
      createdAt: timestamp,
      updatedAt: timestamp,
      handed: 5,
      gameType: 6,
      players: emptyPlayers(),
      fixedSats: [],
      doubleOnBump: true,
      noTrickPartnerDoesntLose: true,
      roles: { picker: null, partner: null, sat: 5 },
      history: [],
      ...overrides
    };
  }

  function createAppData(theme = "dark") {
    return {
      dataVersion: DATA_VERSION,
      preferences: { theme },
      games: [],
      activeGameId: null
    };
  }

  function getActiveGame() {
    return appData.games.find(game => game.id === appData.activeGameId) || appData.games[0] || null;
  }

  function hasSavedGame() {
    return appData && Array.isArray(appData.games) && appData.games.length > 0;
  }

  function createRuntimeDraftGame() {
    return createGame({ id: "new-game-draft" });
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    const hadSavedData = saved !== null;
    let parsed = null;
    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch (e) {
        console.error("Could not parse saved game state", e);
      }
    }
    shouldShowCompatibilityNotice = false;
    shouldOpenNewGameOnFirstRun = false;

    if (!hadSavedData) {
      appData = createAppData();
      state = createRuntimeDraftGame();
      shouldOpenNewGameOnFirstRun = true;
      saveState();
    } else if (!parsed || parsed.dataVersion !== DATA_VERSION || !Array.isArray(parsed.games)) {
      const recoveredTheme = parsed && parsed.theme === "light" ? "light" : "dark";
      appData = createAppData(recoveredTheme);
      state = createRuntimeDraftGame();
      shouldShowCompatibilityNotice = true;
      saveState();
    } else {
      appData = parsed;
      appData.preferences = appData.preferences || {};
      appData.preferences.theme = appData.preferences.theme === "light" ? "light" : "dark";
      appData.games = Array.isArray(appData.games) ? appData.games : [];
      if (hasSavedGame()) {
        appData.activeGameId = appData.games.some(game => game.id === appData.activeGameId)
          ? appData.activeGameId
          : appData.games[0].id;
        state = getActiveGame();
      } else {
        appData.activeGameId = null;
        state = createRuntimeDraftGame();
        shouldOpenNewGameOnFirstRun = true;
      }
    }
    state.handed = [3, 5].includes(parseInt(state.handed)) ? parseInt(state.handed) : 5;
    state.gameType = [3, 4, 5, 6, 7].includes(parseInt(state.gameType)) ? parseInt(state.gameType) : 6;
    state.doubleOnBump = state.doubleOnBump !== false;
    state.noTrickPartnerDoesntLose = state.noTrickPartnerDoesntLose !== false;
    if (state.gameType < state.handed || state.gameType > state.handed + 2) {
      state.handed = state.gameType <= 4 ? 3 : 5;
    }
    state.players = Array.isArray(state.players) ? state.players : emptyPlayers();
    while (state.players.length < MAX_PLAYERS) {
      state.players.push("");
    }
    if (!state.roles) {
      state.roles = { picker: null, partner: null, sat: null };
    }
    state.history = Array.isArray(state.history) ? state.history : [];
    state.fixedSats = Array.isArray(state.fixedSats) ? state.fixedSats : [];
    state.fixedSats = fixedSatIndexes();

    normalizeSatRoles();
    applyTheme();
    updateOutcomeOptions();
  }

  function saveState(options = {}) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      return true;
    } catch (error) {
      console.error("Could not save game state", error);
      if (!options.suppressError) {
        showSaveError();
      }
      return false;
    }
  }

  function initGame() {
    loadState();
    updateStandings();
    if (shouldShowCompatibilityNotice) {
      document.getElementById("compatibilityModal").hidden = false;
    } else if (shouldOpenNewGameOnFirstRun) {
      openNewGameModal();
    }
  }

  function toggleMenu() {
    const menu = document.getElementById("appMenu");
    menu.hidden = !menu.hidden;
  }

  function closeMenu() {
    document.getElementById("appMenu").hidden = true;
  }

  function currentGameModeValue() {
    return state.handed === 3 ? `3-${state.gameType}` : String(state.gameType);
  }

  function parseGameModeValue(value) {
    if (value.includes("-")) {
      const parts = value.split("-").map(part => parseInt(part));
      return { handed: parts[0], gameType: parts[1] };
    }

    return { handed: 5, gameType: parseInt(value) };
  }

  function openNewGameModal() {
    modalMode = "new";
    closeMenu();
    const firstGameRequired = !hasSavedGame();
    document.getElementById("modalTitle").textContent = "New Game";
    document.getElementById("modalSubmitButton").textContent = "Start Game";
    document.getElementById("modalCancelButton").hidden = firstGameRequired;
    document.getElementById("modalGameTypeField").hidden = false;
    document.getElementById("modalRuleSettings").hidden = false;
    document.getElementById("modalGameType").value = currentGameModeValue();
    document.getElementById("doubleOnBumpCheckbox").checked = true;
    document.getElementById("noTrickPartnerCheckbox").checked = true;
    renderModalPlayerInputs(state.gameType, emptyPlayers());
    document.getElementById("settingsModal").hidden = false;
  }

  function openSettingsModal() {
    modalMode = "settings";
    closeMenu();
    document.getElementById("modalTitle").textContent = "Game Settings";
    document.getElementById("modalSubmitButton").textContent = "Save";
    document.getElementById("modalCancelButton").hidden = false;
    document.getElementById("modalGameTypeField").hidden = true;
    document.getElementById("modalRuleSettings").hidden = false;
    updateRuleSettingsInputs();
    renderModalPlayerInputs(state.gameType, state.players);
    document.getElementById("settingsModal").hidden = false;
  }

  function openThemeModal() {
    closeMenu();
    updateThemeToggle();
    document.getElementById("themeModal").hidden = false;
  }

  function openUndoModal() {
    closeMenu();
    const hasHands = state.history.length > 0;
    document.getElementById("undoModalMessage").textContent = hasHands
      ? `Remove hand #${state.history.length} from the history?`
      : "There are no hands to undo.";
    document.getElementById("undoConfirmButton").hidden = !hasHands;
    document.getElementById("undoModal").hidden = false;
  }

  function openAboutModal() {
    closeMenu();
    document.getElementById("appVersion").textContent = APP_VERSION;
    document.getElementById("aboutModal").hidden = false;
  }

  function closeModal() {
    if (modalMode === "new" && !hasSavedGame()) {
      document.getElementById("settingsModal").hidden = false;
      return;
    }
    modalMode = null;
    document.getElementById("settingsModal").hidden = true;
  }

  function closeThemeModal() {
    document.getElementById("themeModal").hidden = true;
  }

  function closeUndoModal() {
    document.getElementById("undoModal").hidden = true;
  }

  function closeAboutModal() {
    document.getElementById("aboutModal").hidden = true;
  }

  function startAfterCompatibilityReset() {
    document.getElementById("compatibilityModal").hidden = true;
    openNewGameModal();
  }

  function showSaveError() {
    document.getElementById("saveErrorMessage").textContent =
      "Unable to save changes in this browser. Recent changes may be lost if you close or reload the app.";
    document.getElementById("saveErrorModal").hidden = false;
  }

  function closeSaveErrorModal() {
    document.getElementById("saveErrorModal").hidden = true;
  }

  function confirmUndoLastHand() {
    if (state.history.length === 0) {
      closeUndoModal();
      return;
    }

    state.history.pop();
    state.updatedAt = nowIso();
    closeUndoModal();
    saveState();
    updateStandings();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = appData.preferences.theme;
  }

  function updateThemeToggle() {
    document.getElementById("themeToggle").checked = appData.preferences.theme === "light";
    document.getElementById("themeToggleText").textContent = appData.preferences.theme === "light" ? "Light mode" : "Dark mode";
  }

  function toggleTheme(useLightTheme) {
    appData.preferences.theme = useLightTheme ? "light" : "dark";
    applyTheme();
    updateThemeToggle();
    saveState();
  }

  function updateRuleSettingsInputs() {
    document.getElementById("doubleOnBumpCheckbox").checked = state.doubleOnBump;
    document.getElementById("noTrickPartnerCheckbox").checked = state.noTrickPartnerDoesntLose;
  }

  function updateOutcomeOptions() {
    const doubleFactor = state.doubleOnBump ? 2 : 1;
    const lossPicker = -2 * doubleFactor;
    const lossPartner = -1 * doubleFactor;
    const schneiderPicker = -4 * doubleFactor;
    const schneiderPartner = -2 * doubleFactor;
    const noTrickDefender = 3 * doubleFactor;
    const noTrickPicker = state.noTrickPartnerDoesntLose ? -3 * noTrickDefender : -6 * doubleFactor;
    const noTrickPartner = state.noTrickPartnerDoesntLose ? 0 : -3 * doubleFactor;

    document.querySelector("#outcomeSelect option[value='win']").textContent = "Win - Standard (+2 / +1)";
    document.querySelector("#outcomeSelect option[value='schneider']").textContent = "Win - Schneider (+4 / +2)";
    document.querySelector("#outcomeSelect option[value='schwarz']").textContent = "Win - No Tricks / Schwarz (+6 / +3)";
    document.querySelector("#outcomeSelect option[value='loss']").textContent =
      `${state.doubleOnBump ? "Loss - Double Bump" : "Loss - Bump"} (${lossPicker} / ${lossPartner})`;
    document.querySelector("#outcomeSelect option[value='schneider-loss']").textContent =
      `Loss - Schneidered (${schneiderPicker} / ${schneiderPartner})`;
    document.querySelector("#outcomeSelect option[value='schwarz-loss']").textContent =
      `Loss - No Tricks Taken (${noTrickPicker} / ${noTrickPartner})`;
  }

  function calculateHand({ picker, partner, sats, outcome, multiplier, gameSettings }) {
    const count = gameSettings.gameType;
    const deltas = new Array(count).fill(0);
    const bumpFactor = gameSettings.doubleOnBump ? 2 : 1;
    let basePicker = 2, basePartner = 1, baseDef = -1;

    switch (outcome) {
      case "schneider":
        basePicker = 4; basePartner = 2; baseDef = -2;
        break;
      case "schwarz":
        basePicker = 6; basePartner = 3; baseDef = -3;
        break;
      case "loss":
        basePicker = -2 * bumpFactor; basePartner = -1 * bumpFactor; baseDef = 1 * bumpFactor;
        break;
      case "schneider-loss":
        basePicker = -4 * bumpFactor; basePartner = -2 * bumpFactor; baseDef = 2 * bumpFactor;
        break;
      case "schwarz-loss":
        basePicker = -6 * bumpFactor; basePartner = -3 * bumpFactor; baseDef = 3 * bumpFactor;
        break;
    }

    const pPts = basePicker * multiplier;
    const ptPts = basePartner * multiplier;
    const defPts = baseDef * multiplier;

    if (gameSettings.handed === 3 || partner === null) {
      let pickerTotal = 0;
      for (let i = 0; i < count; i++) {
        if (i !== picker && !sats.includes(i)) {
          deltas[i] = defPts;
          pickerTotal -= defPts;
        }
      }
      deltas[picker] = pickerTotal;
    } else {
      deltas[picker] = pPts;
      deltas[partner] = outcome === "schwarz-loss" && gameSettings.noTrickPartnerDoesntLose ? 0 : ptPts;
      for (let i = 0; i < count; i++) {
        if (i !== picker && i !== partner && !sats.includes(i)) {
          deltas[i] = defPts;
        }
      }
      if (outcome === "schwarz-loss" && gameSettings.noTrickPartnerDoesntLose) {
        deltas[picker] = 0 - deltas.reduce((sum, delta, index) => (
          index === picker ? sum : sum + delta
        ), 0);
      }
    }

    return deltas;
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function sittingPlayerCount() {
    return Math.max(0, state.gameType - state.handed);
  }

  function defaultSatIndexes(count = state.gameType, handed = state.handed) {
    const sittingCount = Math.max(0, count - handed);
    const start = count - sittingCount;
    return Array.from({ length: sittingCount }, (_, index) => start + index);
  }

  function satIndexes() {
    const rawSat = state.roles.sat;
    const values = Array.isArray(rawSat) ? rawSat : rawSat === null ? [] : [rawSat];
    return values
      .map(index => parseInt(index))
      .filter((index, arrayIndex, indexes) => (
        Number.isInteger(index) &&
        index >= 0 &&
        index < state.gameType &&
        indexes.indexOf(index) === arrayIndex
      ));
  }

  function fixedSatIndexes() {
    const values = Array.isArray(state.fixedSats) ? state.fixedSats : [];
    return values
      .map(index => parseInt(index))
      .filter((index, arrayIndex, indexes) => (
        Number.isInteger(index) &&
        index >= 0 &&
        index < state.gameType &&
        indexes.indexOf(index) === arrayIndex
      ))
      .slice(0, sittingPlayerCount());
  }

  function isFixedSat(index) {
    return fixedSatIndexes().includes(index);
  }

  function storeSatIndexes(indexes) {
    const sittingCount = sittingPlayerCount();
    const limited = indexes.slice(0, sittingCount);
    if (sittingCount === 0) {
      state.roles.sat = null;
    } else if (sittingCount === 1) {
      state.roles.sat = limited.length ? limited[0] : null;
    } else {
      state.roles.sat = limited;
    }
  }

  function isSatOut(index) {
    return satIndexes().includes(index);
  }

  function nextAvailableSatIndex(index, reserved) {
    let next = index;
    for (let step = 0; step < state.gameType; step++) {
      next = (next + 1) % state.gameType;
      if (!isFixedSat(next) && !reserved.includes(next)) {
        return next;
      }
    }
    return null;
  }

  function normalizeSatRoles() {
    const sittingCount = sittingPlayerCount();
    const fixed = fixedSatIndexes();
    state.fixedSats = fixed;
    if (fixed.includes(state.roles.picker)) {
      state.roles.picker = null;
    }
    if (fixed.includes(state.roles.partner)) {
      state.roles.partner = null;
    }
    if (state.handed === 3) {
      state.roles.partner = null;
    }

    if (sittingCount === 0) {
      storeSatIndexes([]);
      return;
    }

    const nextSats = fixed.slice();
    const currentFloatingSats = satIndexes().filter(index => !fixed.includes(index));

    for (let i = 0; i < currentFloatingSats.length && nextSats.length < sittingCount; i++) {
      const index = currentFloatingSats[i];
      if (!nextSats.includes(index)) {
        nextSats.push(index);
      }
    }

    const defaults = defaultSatIndexes().filter(index => !fixed.includes(index));
    for (let i = 0; i < defaults.length && nextSats.length < sittingCount; i++) {
      if (!nextSats.includes(defaults[i])) {
        nextSats.push(defaults[i]);
      }
    }

    for (let i = 0; i < state.gameType && nextSats.length < sittingCount; i++) {
      if (!fixed.includes(i) && !nextSats.includes(i)) {
        nextSats.push(i);
      }
    }

    storeSatIndexes(nextSats);
  }

  function resetRoles() {
    const count = state.gameType;
    const sittingCount = sittingPlayerCount();
    const fixed = fixedSatIndexes();
    let nextSats = fixed.slice();

    // If transitioning from previous round, rotate sitting player clockwise
    if (sittingCount > fixed.length) {
      const currentSats = satIndexes().filter(index => !fixed.includes(index));
      if (currentSats.length === sittingCount - fixed.length) {
        currentSats.forEach(index => {
          const next = nextAvailableSatIndex(index, nextSats);
          if (next !== null) {
            nextSats.push(next);
          }
        });
      }
    }

    state.roles = { picker: null, partner: null, sat: null };
    if (nextSats.length < sittingCount) {
      state.roles.sat = nextSats;
      normalizeSatRoles();
      return;
    }
    storeSatIndexes(nextSats);
  }

  function renderModalPlayerInputs(count, names) {
    const container = document.getElementById("modalPlayerNameInputs");
    container.innerHTML = "";
    const fixed = fixedSatIndexes();

    for (let i = 0; i < count; i++) {
      const div = document.createElement("div");
      div.className = "modal-player-row";
      const val = names[i] || "";
      div.innerHTML = `
        <div class="modal-player-label-row">
          <label style="margin-bottom: 0;">Player ${i + 1}</label>
          ${modalMode === "settings" ? `
            <label class="sit-checkbox-label">
              <input 
                class="modal-fixed-sat"
                type="checkbox"
                value="${i}"
                onchange="updateModalSitCheckboxes()"
                ${fixed.includes(i) ? "checked" : ""}
              />
              Skip
            </label>
          ` : ""}
        </div>
        <input 
          class="modal-player-name"
          type="text" 
          placeholder="Player ${i + 1}" 
          value="${escapeAttribute(val)}" 
        />
      `;
      container.appendChild(div);
    }
    updateModalSitCheckboxes();
  }

  function getModalNames() {
    const names = emptyPlayers();
    document.querySelectorAll(".modal-player-name").forEach((input, index) => {
      names[index] = input.value;
    });
    return names;
  }

  function getModalFixedSats() {
    return Array.from(document.querySelectorAll(".modal-fixed-sat:checked"))
      .map(input => parseInt(input.value));
  }

  function updateModalSitCheckboxes() {
    const checkboxes = Array.from(document.querySelectorAll(".modal-fixed-sat"));
    const maxSitting = sittingPlayerCount();
    const checkedCount = checkboxes.filter(checkbox => checkbox.checked).length;

    checkboxes.forEach(checkbox => {
      checkbox.disabled = !checkbox.checked && checkedCount >= maxSitting;
      checkbox.closest(".sit-checkbox-label").classList.toggle("disabled", checkbox.disabled);
    });
  }

  function handleModalGameTypeChange() {
    const mode = parseGameModeValue(document.getElementById("modalGameType").value);
    renderModalPlayerInputs(mode.gameType, getModalNames());
  }

  function saveModal(event) {
    event.preventDefault();
    const names = getModalNames();

    if (modalMode === "new") {
      const mode = parseGameModeValue(document.getElementById("modalGameType").value);
      const newGame = createGame({
        handed: mode.handed,
        gameType: mode.gameType,
        players: names,
        roles: { picker: null, partner: null, sat: null },
        doubleOnBump: document.getElementById("doubleOnBumpCheckbox").checked,
        noTrickPartnerDoesntLose: document.getElementById("noTrickPartnerCheckbox").checked
      });
      const activeIndex = appData.games.findIndex(game => game.id === appData.activeGameId);
      if (activeIndex >= 0) {
        appData.games[activeIndex] = newGame;
      } else {
        appData.games.push(newGame);
      }
      appData.activeGameId = newGame.id;
      state = newGame;
      storeSatIndexes(defaultSatIndexes());
    } else if (modalMode === "settings") {
      for (let i = 0; i < state.gameType; i++) {
        state.players[i] = names[i];
      }
      state.fixedSats = getModalFixedSats();
      if (isFixedSat(state.roles.picker)) {
        state.roles.picker = null;
      }
      if (isFixedSat(state.roles.partner)) {
        state.roles.partner = null;
      }
      state.doubleOnBump = document.getElementById("doubleOnBumpCheckbox").checked;
      state.noTrickPartnerDoesntLose = document.getElementById("noTrickPartnerCheckbox").checked;
      normalizeSatRoles();
    }
    state.updatedAt = nowIso();

    closeModal();
    saveState();
    updateOutcomeOptions();
    updateStandings();
  }

  function isHandReadyToSubmit() {
    return state.roles.picker !== null && satIndexes().length === sittingPlayerCount();
  }

  function updateSubmitButton() {
    document.getElementById("submitHandButton").disabled = !isHandReadyToSubmit();
  }

  function toggleHistoryOrder() {
    state.historyNewestFirst = !state.historyNewestFirst;
    saveState();
    updateStandings();
  }

  function toggleHistoryScoreMode() {
    state.historyShowTotals = !state.historyShowTotals;
    saveState();
    updateStandings();
  }

  function updateRoleInstruction() {
    const instruction = document.getElementById("roleInstruction");
    instruction.textContent = "Tap player cards to assign roles.";
  }

  function handleCardTap(index) {
    if (isFixedSat(index)) {
      return;
    }

    const sittingCount = sittingPlayerCount();
    const hasPartner = state.handed === 5;

    if (state.roles.picker === index) {
      state.roles.picker = null;
      if (hasPartner) {
        if (state.roles.partner !== null) state.roles.partner = null;
        state.roles.partner = index;
      } else if (sittingCount > 0 && satIndexes().length < sittingCount) {
        const sats = satIndexes();
        sats.push(index);
        storeSatIndexes(sats);
      }
    } else if (state.roles.partner === index) {
      state.roles.partner = null;
      if (sittingCount > 0) {
        const sats = satIndexes().filter(satIndex => satIndex !== index);
        if (sats.length < sittingCount) {
          sats.push(index);
          storeSatIndexes(sats);
        }
      }
    } else if (isSatOut(index)) {
      storeSatIndexes(satIndexes().filter(satIndex => satIndex !== index));
    } else {
      if (state.roles.picker === null) {
        state.roles.picker = index;
      } else if (hasPartner && state.roles.partner === null) {
        state.roles.partner = index;
      } else if (sittingCount > 0 && satIndexes().length < sittingCount) {
        const sats = satIndexes();
        sats.push(index);
        storeSatIndexes(sats);
      }
    }

    saveState();
    updateStandings();
  }

  function openEditHandModal(historyIndex) {
    const hand = state.history[historyIndex];
    if (!hand || hand.picker === undefined) {
      return;
    }

    editHandIndex = historyIndex;
    editHandDraft = {
      picker: hand.picker,
      partner: state.handed === 5 && hand.partner !== undefined ? hand.partner : null,
      sats: Array.isArray(hand.sats) ? hand.sats.slice() : [],
      outcome: hand.outcome || "win",
      multiplier: hand.multiplier || 1
    };

    document.getElementById("editHandTitle").textContent = `Edit Hand #${historyIndex + 1}`;
    document.getElementById("editOutcomeSelect").innerHTML = document.getElementById("outcomeSelect").innerHTML;
    document.getElementById("editOutcomeSelect").value = editHandDraft.outcome;
    document.getElementById("editMultiplierSelect").value = String(editHandDraft.multiplier);
    renderEditHandPlayers();
    document.getElementById("editHandModal").hidden = false;
  }

  function closeEditHandModal() {
    editHandIndex = null;
    editHandDraft = null;
    document.getElementById("editHandModal").hidden = true;
  }

  function editDraftHasSat(index) {
    return editHandDraft.sats.includes(index);
  }

  function storeEditDraftSats(sats) {
    editHandDraft.sats = sats.slice(0, sittingPlayerCount());
  }

  function handleEditCardTap(index) {
    if (!editHandDraft) {
      return;
    }

    const sittingCount = sittingPlayerCount();
    const hasPartner = state.handed === 5;

    if (editHandDraft.picker === index) {
      editHandDraft.picker = null;
      if (hasPartner) {
        if (editHandDraft.partner !== null) editHandDraft.partner = null;
        editHandDraft.partner = index;
      } else if (sittingCount > 0 && editHandDraft.sats.length < sittingCount) {
        editHandDraft.sats.push(index);
      }
    } else if (editHandDraft.partner === index) {
      editHandDraft.partner = null;
      if (sittingCount > 0) {
        const sats = editHandDraft.sats.filter(satIndex => satIndex !== index);
        if (sats.length < sittingCount) {
          sats.push(index);
        }
        storeEditDraftSats(sats);
      }
    } else if (editDraftHasSat(index)) {
      storeEditDraftSats(editHandDraft.sats.filter(satIndex => satIndex !== index));
    } else {
      if (editHandDraft.picker === null) {
        editHandDraft.picker = index;
      } else if (hasPartner && editHandDraft.partner === null) {
        editHandDraft.partner = index;
      } else if (sittingCount > 0 && editHandDraft.sats.length < sittingCount) {
        editHandDraft.sats.push(index);
      }
    }

    if (state.handed === 3) {
      editHandDraft.partner = null;
    }
    renderEditHandPlayers();
  }

  function renderEditHandPlayers() {
    const grid = document.getElementById("editHandPlayersGrid");
    const count = state.gameType;
    grid.style.setProperty("--mobile-player-columns", Math.ceil(count / 2));
    grid.style.setProperty("--player-count", count);
    grid.innerHTML = "";

    for (let i = 0; i < count; i++) {
      let cardClass = "";
      let badgeHtml = "";

      if (editHandDraft.picker === i) {
        cardClass = "picker";
        badgeHtml = `<div class="role-badge badge-picker">Picker</div>`;
      } else if (editHandDraft.partner === i) {
        cardClass = "partner";
        badgeHtml = `<div class="role-badge badge-partner">Partner</div>`;
      } else if (editDraftHasSat(i)) {
        cardClass = "sat";
        badgeHtml = `<div class="role-badge badge-sat">Sat Out</div>`;
      }

      grid.innerHTML += `
        <div class="total-card ${cardClass}" onclick="handleEditCardTap(${i})">
          <div class="total-name">${getDisplayName(i)}</div>
          <div class="total-score">#${i + 1}</div>
          <div class="role-badge-slot">${badgeHtml}</div>
        </div>
      `;
    }

    document.getElementById("saveEditHandButton").disabled =
      editHandDraft.picker === null || editHandDraft.sats.length !== sittingPlayerCount();
  }

  function saveEditedHand(event) {
    event.preventDefault();
    if (!editHandDraft || editHandDraft.picker === null || editHandDraft.sats.length !== sittingPlayerCount()) {
      return;
    }

    const hand = state.history[editHandIndex];
    const outcome = document.getElementById("editOutcomeSelect").value;
    const multiplier = parseInt(document.getElementById("editMultiplierSelect").value);
    const partner = state.handed === 5 && editHandDraft.partner !== null ? editHandDraft.partner : null;
    const sats = editHandDraft.sats.slice();
    const deltas = calculateHand({
      picker: editHandDraft.picker,
      partner,
      sats,
      outcome,
      multiplier,
      gameSettings: state
    });

    state.history[editHandIndex] = {
      ...hand,
      picker: editHandDraft.picker,
      partner,
      sats,
      outcome,
      multiplier,
      deltas
    };
    state.updatedAt = nowIso();
    closeEditHandModal();
    saveState();
    updateStandings();
  }

  function submitPresetHand() {
    if (!isHandReadyToSubmit()) {
      return;
    }

    const count = state.gameType;
    const pickerIdx = state.roles.picker;
    const partnerIdx = state.roles.partner;
    const sats = satIndexes();

    const outcome = document.getElementById("outcomeSelect").value;
    const mult = parseInt(document.getElementById("multiplierSelect").value);
    const effectivePartner = state.handed === 5 && partnerIdx !== null ? partnerIdx : null;
    const deltas = calculateHand({
      picker: pickerIdx,
      partner: effectivePartner,
      sats,
      outcome,
      multiplier: mult,
      gameSettings: state
    });

    state.history.push({
      id: createId("hand"),
      deltas,
      picker: pickerIdx,
      partner: effectivePartner,
      sats,
      outcome,
      multiplier: mult
    });

    // Rotate sitting player clockwise for the next hand
    resetRoles();
    document.getElementById("outcomeSelect").selectedIndex = 0;
    document.getElementById("multiplierSelect").selectedIndex = 0;
    state.updatedAt = nowIso();
    saveState();
    updateStandings();
  }

  function getDisplayName(index) {
    return state.players[index] && state.players[index].trim() !== "" 
      ? state.players[index] 
      : `Player ${index + 1}`;
  }

  function updateStandings() {
    const count = state.gameType;
    const totals = new Array(count).fill(0);
    updateRoleInstruction();

    state.history.forEach(hand => {
      hand.deltas.forEach((d, idx) => {
        if (idx < count) totals[idx] += d;
      });
    });

    // Render Standings Grid
    const totalsGrid = document.getElementById("totalsGrid");
    totalsGrid.style.setProperty("--mobile-player-columns", Math.ceil(count / 2));
    totalsGrid.style.setProperty("--player-count", count);
    totalsGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const val = totals[i];
      const cls = val > 0 ? "pos" : val < 0 ? "neg" : "";
      
      let cardClass = "";
      let badgeHtml = "";

      if (state.roles.picker === i) {
        cardClass = "picker";
        badgeHtml = `<div class="role-badge badge-picker">Picker</div>`;
      } else if (state.roles.partner === i) {
        cardClass = "partner";
        badgeHtml = `<div class="role-badge badge-partner">Partner</div>`;
      } else if (isSatOut(i)) {
        cardClass = "sat";
        badgeHtml = isFixedSat(i)
          ? `<div class="role-badge badge-sitting">Sitting</div>`
          : `<div class="role-badge badge-sat">Sat Out</div>`;
      }

      totalsGrid.innerHTML += `
        <div class="total-card ${cardClass}" onclick="handleCardTap(${i})">
          <div class="total-name">${getDisplayName(i)}</div>
          <div class="total-score ${cls}">${val > 0 ? '+' : ''}${val}</div>
          <div class="role-badge-slot">${badgeHtml}</div>
        </div>
      `;
    }

    // Render Table Header
    const th = document.getElementById("tableHeader");
    th.innerHTML = "<th>#</th>";
    for (let i = 0; i < count; i++) {
      th.innerHTML += `<th>${getDisplayName(i)}</th>`;
    }

    // Render History Table
    const historyOrderButton = document.getElementById("historyOrderButton");
    historyOrderButton.textContent = state.historyNewestFirst ? "Oldest First" : "Newest First";
    const historyScoreModeButton = document.getElementById("historyScoreModeButton");
    historyScoreModeButton.textContent = state.historyShowTotals ? "Show Hands" : "Show Totals";
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";
    const runningTotals = new Array(count).fill(0);
    const historyRows = state.history.map((hand, hIdx) => {
      hand.deltas.forEach((delta, index) => {
        if (index < count) runningTotals[index] += delta;
      });

      return {
        hand,
        handNumber: hIdx + 1,
        totals: runningTotals.slice()
      };
    });
    if (state.historyNewestFirst) {
      historyRows.reverse();
    }

    historyRows.forEach(({ hand, handNumber, totals }) => {
      let tr = `<tr><td><button class="inline-button" type="button" onclick="openEditHandModal(${handNumber - 1})">${handNumber}</button></td>`;
      for (let i = 0; i < count; i++) {
        let val = state.historyShowTotals ? totals[i] : hand.deltas[i] || 0;
        let cls = val > 0 ? "pos" : val < 0 ? "neg" : "";
        if (hand.picker === i) {
          cls += " history-picker-cell";
        } else if (hand.partner === i) {
          cls += " history-partner-cell";
        }
        tr += `<td class="${cls}">${val > 0 ? '+' : ''}${val}</td>`;
      }
      tr += "</tr>";
      tbody.innerHTML += tr;
    });

    updateSubmitButton();
  }

  // Initial setup
  initGame();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/SheepsheadScoringApp/sw.js", {
        scope: "/SheepsheadScoringApp/"
      }).catch(error => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
