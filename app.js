  const STORAGE_KEY = "sheepshead_scorekeeper_data";
  const APP_VERSION = self.SHEEPSHEAD_APP_VERSION;
  const DATA_VERSION = 3;
  const MAX_PLAYERS = 8;

  let appData = null;
  let state = null;
  let modalMode = null;
  let modalPlayerDrafts = [];
  let modalDefaultGameName = "";
  let editHandIndex = null;
  let editHandDraft = null;
  let pendingDeleteGameId = null;
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

  function createPlayer(name = "") {
    return {
      id: createId("player"),
      name
    };
  }

  function emptyPlayers(count = MAX_PLAYERS) {
    return Array.from({ length: count }, () => createPlayer());
  }

  function normalizePlayer(player) {
    if (player && typeof player === "object" && typeof player.id === "string") {
      return {
        id: player.id,
        name: typeof player.name === "string" ? player.name : ""
      };
    }
    return createPlayer(typeof player === "string" ? player : "");
  }

  function activePlayers(game = state) {
    return game.players.slice(0, game.playerCount);
  }

  function activePlayerIds(game = state) {
    return activePlayers(game).map(player => player.id);
  }

  function playerAt(index) {
    return activePlayers()[index] || null;
  }

  function playerIdAt(index) {
    const player = playerAt(index);
    return player ? player.id : null;
  }

  function playerIndexById(id) {
    return activePlayers().findIndex(player => player.id === id);
  }

  function gameMode(game = state) {
    if (game && ["three", "five", "cut-throat", "partners"].includes(game.mode)) return game.mode;
    return parseInt(game && game.handed) === 3 ? "three" : "five";
  }

  function handedForMode(mode) {
    return mode === "three" ? 3 : mode === "five" ? 5 : 4;
  }

  function gameTypeLabel(game = state) {
    return ({ three: "3-Handed", "cut-throat": "4-Handed Cut Throat", partners: "4-Handed Partners", five: "5-Handed" })[gameMode(game)];
  }

  function isPartnersGame(game = state) {
    return gameMode(game) === "partners";
  }

  function hasPartnerRole(game = state) {
    return gameMode(game) === "five" || isPartnersGame(game);
  }

  function doubleOnBumpAllowed(game = state) {
    return gameMode(game) !== "partners";
  }

  function noTrickPartnerRuleAllowed(game = state) {
    return gameMode(game) === "five";
  }

  function defaultSatIds(count = state.playerCount, handed = state.handed, players = state.players) {
    return defaultSatIndexes(count, handed)
      .map(index => players[index])
      .filter(Boolean)
      .map(player => player.id);
  }

  function validPlayerCountsForMode(mode) {
    return mode === "three" ? [3, 4] : mode === "five" ? [5, 6, 7, 8] : [4, 5];
  }

  function defaultPlayerCountForMode(mode) {
    return mode === "three" ? 3 : mode === "five" ? 5 : 4;
  }

  function defaultGameName() {
    const dateLabel = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
    return `${dateLabel} Game`;
  }

  function fallbackGameName(game = state) {
    if (appData && Array.isArray(appData.games)) {
      const index = appData.games.indexOf(game);
      if (index >= 0) {
        return `Game ${index + 1}`;
      }
    }
    return "Untitled Game";
  }

  function displayGameName(game = state) {
    return game && game.name && game.name.trim() ? game.name.trim() : fallbackGameName(game);
  }

  function maxPlayerCountForMode(mode) {
    return validPlayerCountsForMode(mode).at(-1);
  }

  function normalizePlayerCountForMode(mode, count) {
    const parsed = parseInt(count);
    const validCounts = validPlayerCountsForMode(mode);
    return validCounts.includes(parsed) ? parsed : defaultPlayerCountForMode(mode);
  }

  function createGame(overrides = {}) {
    const timestamp = nowIso();
    return {
      id: createId("game"),
      name: "Game",
      createdAt: timestamp,
      updatedAt: timestamp,
      handed: 5,
      mode: "five",
      playerCount: 6,
      players: emptyPlayers(),
      fixedSatIds: [],
      doubleOnBump: true,
      noTrickPartnerDoesntLose: true,
      roles: { pickerId: null, partnerId: null, satIds: [] },
      history: [],
      historyNewestFirst: true,
      historyShowTotals: true,
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

  function sortedGames() {
    return appData.games.slice().sort((a, b) => {
      const bTime = Date.parse(b.updatedAt || b.createdAt || "") || 0;
      const aTime = Date.parse(a.updatedAt || a.createdAt || "") || 0;
      return bTime - aTime;
    });
  }

  function normalizeCurrentGameState() {
    state.mode = gameMode(state);
    state.handed = handedForMode(state.mode);
    state.name = state.name && state.name.trim() ? state.name.trim() : fallbackGameName(state);
    state.createdAt = state.createdAt || nowIso();
    state.updatedAt = state.updatedAt || state.createdAt;
    const savedPlayerCount = state.playerCount ?? state.gameType;
    state.playerCount = normalizePlayerCountForMode(state.mode, savedPlayerCount);
    state.doubleOnBump = state.doubleOnBump !== false;
    state.noTrickPartnerDoesntLose = state.noTrickPartnerDoesntLose !== false;
    if (!validPlayerCountsForMode(state.mode).includes(state.playerCount)) {
      state.mode = state.playerCount <= 4 ? "three" : "five";
      state.handed = handedForMode(state.mode);
      state.playerCount = normalizePlayerCountForMode(state.mode, state.playerCount);
    }
    state.players = Array.isArray(state.players) ? state.players.map(normalizePlayer) : emptyPlayers();
    while (state.players.length < MAX_PLAYERS) {
      state.players.push(createPlayer());
    }
    if (!state.roles) {
      state.roles = { pickerId: null, partnerId: null, satIds: [] };
    }
    state.roles.pickerId = activePlayerIds().includes(state.roles.pickerId) ? state.roles.pickerId : null;
    state.roles.partnerId = activePlayerIds().includes(state.roles.partnerId) ? state.roles.partnerId : null;
    state.roles.satIds = Array.isArray(state.roles.satIds) ? state.roles.satIds : [];
    state.history = Array.isArray(state.history) ? state.history : [];
    state.historyNewestFirst = state.historyNewestFirst !== false;
    state.historyShowTotals = state.historyShowTotals !== false;
    state.fixedSatIds = Array.isArray(state.fixedSatIds) ? state.fixedSatIds : [];
    state.fixedSatIds = fixedSatIds();

    normalizeSatRoles();
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
      const recoveredTheme = parsed && (parsed.theme === "light" || parsed.preferences?.theme === "light") ? "light" : "dark";
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
    normalizeCurrentGameState();
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

  function populateModalPlayerCountOptions(mode, selectedCount) {
    const select = document.getElementById("modalPlayerCount");
    const validCounts = validPlayerCountsForMode(mode);
    const nextSelected = validCounts.includes(parseInt(selectedCount))
      ? parseInt(selectedCount)
      : defaultPlayerCountForMode(mode);
    select.innerHTML = "";
    validCounts.forEach(count => {
      select.innerHTML += `<option value="${count}">${count}</option>`;
    });
    select.value = String(nextSelected);
    return nextSelected;
  }

  function currentModalGameSettings() {
    const mode = document.getElementById("modalHanded").value;
    const playerCount = parseInt(document.getElementById("modalPlayerCount").value);
    return {
      mode,
      handed: handedForMode(mode),
      playerCount: normalizePlayerCountForMode(mode, playerCount)
    };
  }

  function openNewGameModal() {
    modalMode = "new";
    closeMenu();
    const firstGameRequired = !hasSavedGame();
    document.getElementById("modalTitle").textContent = "New Game";
    document.getElementById("modalSubmitButton").textContent = "Start Game";
    document.getElementById("modalCancelButton").hidden = firstGameRequired;
    modalDefaultGameName = defaultGameName();
    const gameNameInput = document.getElementById("modalGameName");
    gameNameInput.value = "";
    gameNameInput.placeholder = modalDefaultGameName;
    gameNameInput.required = false;
    document.getElementById("modalGameTypeField").hidden = false;
    document.getElementById("modalRuleSettings").hidden = false;
    document.getElementById("modalHanded").value = gameMode(state);
    const playerCount = populateModalPlayerCountOptions(gameMode(state), defaultPlayerCountForMode(gameMode(state)));
    document.getElementById("addPlayerButton").hidden = true;
    document.getElementById("doubleOnBumpCheckbox").checked = true;
    document.getElementById("noTrickPartnerCheckbox").checked = true;
    updateRuleSettingsAvailability(gameMode(state));
    modalPlayerDrafts = emptyPlayers();
    renderModalPlayerInputs(playerCount, modalPlayerDrafts);
    document.getElementById("settingsModal").hidden = false;
  }

  function openSettingsModal() {
    modalMode = "settings";
    closeMenu();
    document.getElementById("modalTitle").textContent = "Game Settings";
    document.getElementById("modalSubmitButton").textContent = "Save";
    document.getElementById("modalCancelButton").hidden = false;
    const gameNameInput = document.getElementById("modalGameName");
    gameNameInput.value = displayGameName(state);
    gameNameInput.placeholder = "";
    gameNameInput.required = true;
    document.getElementById("modalGameTypeField").hidden = true;
    document.getElementById("modalRuleSettings").hidden = false;
    document.getElementById("addPlayerButton").hidden = false;
    updateRuleSettingsInputs();
    updateRuleSettingsAvailability(gameMode(state));
    modalPlayerDrafts = state.players.map(normalizePlayer);
    renderModalPlayerInputs(state.playerCount, state.players);
    document.getElementById("settingsModal").hidden = false;
  }

  function openGamesModal() {
    closeMenu();
    renderGamesList();
    document.getElementById("gamesModal").hidden = false;
  }

  function closeGamesModal() {
    document.getElementById("gamesModal").hidden = true;
  }

  function openNewGameFromGames() {
    closeGamesModal();
    openNewGameModal();
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

  function closeDeleteGameModal() {
    pendingDeleteGameId = null;
    document.getElementById("deleteGameModal").hidden = true;
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

  function updateRuleSettingsAvailability(mode = gameMode(state)) {
    const doubleOnBumpCheckbox = document.getElementById("doubleOnBumpCheckbox");
    const noTrickPartnerCheckbox = document.getElementById("noTrickPartnerCheckbox");
    doubleOnBumpCheckbox.disabled = mode === "partners";
    noTrickPartnerCheckbox.disabled = mode !== "five";
    document.getElementById("doubleOnBumpSetting").classList.toggle("disabled", doubleOnBumpCheckbox.disabled);
    document.getElementById("noTrickPartnerSetting").classList.toggle("disabled", noTrickPartnerCheckbox.disabled);
  }

  function updateOutcomeOptions() {
    if (isPartnersGame()) {
      document.querySelector("#outcomeSelect option[value='win']").textContent = "Win - Standard (+1 / +1)";
      document.querySelector("#outcomeSelect option[value='schneider']").textContent = "Win - Schneider (+2 / +2)";
      document.querySelector("#outcomeSelect option[value='schwarz']").textContent = "Win - No Tricks / Schwarz (+3 / +3)";
      document.querySelector("#outcomeSelect option[value='loss']").textContent = "Loss - Bump (-1 / -1)";
      document.querySelector("#outcomeSelect option[value='schneider-loss']").textContent = "Loss - Schneidered (-2 / -2)";
      document.querySelector("#outcomeSelect option[value='schwarz-loss']").textContent = "Loss - No Tricks Taken (-3 / -3)";
      return;
    }
    const doubleFactor = state.doubleOnBump && doubleOnBumpAllowed() ? 2 : 1;
    const lossPicker = -2 * doubleFactor;
    const lossPartner = -1 * doubleFactor;
    const schneiderPicker = -4 * doubleFactor;
    const schneiderPartner = -2 * doubleFactor;
    const noTrickDefender = 3 * doubleFactor;
    const noTrickPartnerDoesntLose = noTrickPartnerRuleAllowed() && state.noTrickPartnerDoesntLose;
    const noTrickPicker = noTrickPartnerDoesntLose ? -3 * noTrickDefender : -6 * doubleFactor;
    const noTrickPartner = noTrickPartnerDoesntLose ? 0 : -3 * doubleFactor;

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
    const players = activePlayers(gameSettings);
    const playerIds = players.map(player => player.id);
    const deltas = {};
    const bumpFactor = gameSettings.doubleOnBump && doubleOnBumpAllowed(gameSettings) ? 2 : 1;
    let basePicker = 2, basePartner = 1, baseDef = -1;

    if (isPartnersGame(gameSettings) && partner !== null) {
      const value = outcome === "schneider" || outcome === "schneider-loss" ? 2
        : outcome === "schwarz" || outcome === "schwarz-loss" ? 3 : 1;
      const attackersWin = !outcome.endsWith("loss");
      const attackerPoints = (attackersWin ? value : -value) * multiplier;
      const defenderPoints = -attackerPoints;
      playerIds.forEach(id => {
        if (id === picker || id === partner) deltas[id] = attackerPoints;
        else if (!sats.includes(id)) deltas[id] = defenderPoints;
      });
      return deltas;
    }

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
      playerIds.forEach(id => {
        if (id !== picker && !sats.includes(id)) {
          deltas[id] = defPts;
          pickerTotal -= defPts;
        }
      });
      deltas[picker] = pickerTotal;
    } else {
      deltas[picker] = pPts;
      const noTrickPartnerDoesntLose = noTrickPartnerRuleAllowed(gameSettings) && gameSettings.noTrickPartnerDoesntLose;
      deltas[partner] = outcome === "schwarz-loss" && noTrickPartnerDoesntLose ? 0 : ptPts;
      playerIds.forEach(id => {
        if (id !== picker && id !== partner && !sats.includes(id)) {
          deltas[id] = defPts;
        }
      });
      if (outcome === "schwarz-loss" && noTrickPartnerDoesntLose) {
        deltas[picker] = 0 - Object.entries(deltas).reduce((sum, [id, delta]) => (
          id === picker ? sum : sum + delta
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
    return Math.max(0, state.playerCount - state.handed);
  }

  function defaultSatIndexes(count = state.playerCount, handed = state.handed) {
    const sittingCount = Math.max(0, count - handed);
    const start = count - sittingCount;
    return Array.from({ length: sittingCount }, (_, index) => start + index);
  }

  function validPlayerIds(ids) {
    const available = activePlayerIds();
    return ids
      .filter((id, index, values) => available.includes(id) && values.indexOf(id) === index);
  }

  function satIds() {
    return validPlayerIds(Array.isArray(state.roles.satIds) ? state.roles.satIds : []);
  }

  function fixedSatIds() {
    return validPlayerIds(Array.isArray(state.fixedSatIds) ? state.fixedSatIds : [])
      .slice(0, sittingPlayerCount());
  }

  function isFixedSat(index) {
    const id = playerIdAt(index);
    return id !== null && fixedSatIds().includes(id);
  }

  function storeSatIds(ids) {
    const sittingCount = sittingPlayerCount();
    state.roles.satIds = validPlayerIds(ids).slice(0, sittingCount);
  }

  function isSatOut(index) {
    const id = playerIdAt(index);
    return id !== null && satIds().includes(id);
  }

  function nextAvailableSatId(id, reserved) {
    let next = playerIndexById(id);
    if (next < 0) {
      return null;
    }
    for (let step = 0; step < state.playerCount; step++) {
      next = (next + 1) % state.playerCount;
      const nextId = playerIdAt(next);
      if (nextId && !fixedSatIds().includes(nextId) && !reserved.includes(nextId)) {
        return nextId;
      }
    }
    return null;
  }

  function normalizeSatRoles() {
    const sittingCount = sittingPlayerCount();
    const fixed = fixedSatIds();
    state.fixedSatIds = fixed;
    if (fixed.includes(state.roles.pickerId)) {
      state.roles.pickerId = null;
    }
    if (fixed.includes(state.roles.partnerId)) {
      state.roles.partnerId = null;
    }
    if (!hasPartnerRole()) {
      state.roles.partnerId = null;
    }

    if (sittingCount === 0) {
      storeSatIds([]);
      return;
    }

    const nextSats = fixed.slice();
    const currentFloatingSats = satIds().filter(id => !fixed.includes(id));

    for (let i = 0; i < currentFloatingSats.length && nextSats.length < sittingCount; i++) {
      const id = currentFloatingSats[i];
      if (!nextSats.includes(id)) {
        nextSats.push(id);
      }
    }

    const defaults = defaultSatIds().filter(id => !fixed.includes(id));
    for (let i = 0; i < defaults.length && nextSats.length < sittingCount; i++) {
      if (!nextSats.includes(defaults[i])) {
        nextSats.push(defaults[i]);
      }
    }

    for (let i = 0; i < state.playerCount && nextSats.length < sittingCount; i++) {
      const id = playerIdAt(i);
      if (id && !fixed.includes(id) && !nextSats.includes(id)) {
        nextSats.push(id);
      }
    }

    storeSatIds(nextSats);
  }

  function resetRoles() {
    const sittingCount = sittingPlayerCount();
    const fixed = fixedSatIds();
    let nextSats = fixed.slice();

    // If transitioning from previous round, rotate sitting player clockwise
    if (sittingCount > fixed.length) {
      const currentSats = satIds().filter(id => !fixed.includes(id));
      if (currentSats.length === sittingCount - fixed.length) {
        currentSats.forEach(id => {
          const next = nextAvailableSatId(id, nextSats);
          if (next !== null) {
            nextSats.push(next);
          }
        });
      }
    }

    state.roles = { pickerId: null, partnerId: null, satIds: [] };
    if (nextSats.length < sittingCount) {
      state.roles.satIds = nextSats;
      normalizeSatRoles();
      return;
    }
    storeSatIds(nextSats);
  }

  function renderModalPlayerInputs(count, players) {
    const container = document.getElementById("modalPlayerNameInputs");
    container.className = modalMode === "settings" ? "modal-player-list" : "grid";
    container.innerHTML = "";
    const fixed = fixedSatIds();
    modalPlayerDrafts = Array.from({ length: MAX_PLAYERS }, (_, index) => normalizePlayer(players[index]));
    const modalPlayers = modalPlayerDrafts.slice(0, count);

    for (let i = 0; i < count; i++) {
      const player = modalPlayers[i];
      const div = document.createElement("div");
      div.className = "modal-player-row";
      div.dataset.playerId = player.id;
      div.draggable = modalMode === "settings";
      div.addEventListener("dragstart", handleModalDragStart);
      div.addEventListener("dragover", handleModalDragOver);
      div.addEventListener("dragend", handleModalDragEnd);
      div.addEventListener("drop", handleModalDrop);
      const val = player.name || "";
      div.innerHTML = modalMode === "settings" ? `
        <div class="modal-player-top">
          <span class="modal-player-label-text">Player ${i + 1}</span>
          ${modalMode === "settings" ? `
            <label class="sit-checkbox-label">
              <input 
                class="modal-fixed-sat"
                type="checkbox"
                value="${escapeAttribute(player.id)}"
                onchange="updateModalSitCheckboxes()"
                ${fixed.includes(player.id) ? "checked" : ""}
              />
              Skip
            </label>
          ` : ""}
        </div>
        <div class="modal-player-main">
          <button
            class="reorder-handle"
            type="button"
            aria-label="Drag to reorder Player ${i + 1}"
            title="Drag to reorder"
            onpointerdown="startModalPointerReorder(event)"
          >≡</button>
          <input 
            class="modal-player-name"
            type="text" 
            placeholder="Player ${i + 1}" 
            value="${escapeAttribute(val)}" 
          />
        </div>
      ` : `
        <label>Player ${i + 1}</label>
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
    updateModalPlayerLabels();
    updateAddPlayerButton();
  }

  function getModalPlayerCount() {
    return document.querySelectorAll(".modal-player-row").length;
  }

  function getModalPlayers() {
    const players = modalPlayerDrafts.length ? modalPlayerDrafts.map(normalizePlayer) : emptyPlayers();
    document.querySelectorAll(".modal-player-row").forEach((row, index) => {
      const input = row.querySelector(".modal-player-name");
      players[index] = {
        id: row.dataset.playerId || createId("player"),
        name: input ? input.value : ""
      };
    });
    return players;
  }

  function updateAddPlayerButton() {
    const button = document.getElementById("addPlayerButton");
    if (!button) return;
    if (modalMode !== "settings") {
      button.hidden = true;
      return;
    }
    const atMax = getModalPlayerCount() >= maxPlayerCountForMode(gameMode(state));
    button.hidden = atMax;
    button.disabled = atMax;
  }

  function addModalPlayer() {
    if (modalMode !== "settings") {
      return;
    }
    const count = getModalPlayerCount();
    const maxCount = maxPlayerCountForMode(gameMode(state));
    if (count >= maxCount) {
      updateAddPlayerButton();
      return;
    }
    const players = getModalPlayers();
    players[count] = createPlayer();
    renderModalPlayerInputs(count + 1, players);
  }

  function getModalFixedSats() {
    return Array.from(document.querySelectorAll(".modal-fixed-sat:checked"))
      .map(input => input.value);
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

  function updateModalPlayerLabels() {
    document.querySelectorAll(".modal-player-row").forEach((row, index) => {
      const label = row.querySelector(".modal-player-label-text");
      const input = row.querySelector(".modal-player-name");
      const handle = row.querySelector(".reorder-handle");
      if (label) label.textContent = `Player ${index + 1}`;
      if (input) input.placeholder = `Player ${index + 1}`;
      if (handle) handle.setAttribute("aria-label", `Drag to reorder Player ${index + 1}`);
    });
  }

  let draggedModalPlayerRow = null;

  function handleModalDragStart(event) {
    if (modalMode !== "settings") return;
    draggedModalPlayerRow = event.currentTarget;
    draggedModalPlayerRow.classList.add("dragging");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedModalPlayerRow.dataset.playerId || "");
    }
  }

  function handleModalDragOver(event) {
    if (!draggedModalPlayerRow || event.currentTarget === draggedModalPlayerRow) return;
    event.preventDefault();
    const target = event.currentTarget;
    const rect = target.getBoundingClientRect();
    const afterTarget = event.clientY > rect.top + rect.height / 2;
    target.parentElement.insertBefore(draggedModalPlayerRow, afterTarget ? target.nextSibling : target);
    updateModalPlayerLabels();
    updateAddPlayerButton();
  }

  function handleModalDrop(event) {
    if (draggedModalPlayerRow) {
      event.preventDefault();
    }
  }

  function handleModalDragEnd() {
    if (draggedModalPlayerRow) {
      draggedModalPlayerRow.classList.remove("dragging");
      draggedModalPlayerRow = null;
      updateModalSitCheckboxes();
      updateModalPlayerLabels();
    }
  }

  function startModalPointerReorder(event) {
    if (modalMode !== "settings") return;
    const row = event.currentTarget.closest(".modal-player-row");
    if (!row) return;
    event.preventDefault();
    draggedModalPlayerRow = row;
    row.classList.add("dragging");
    event.currentTarget.setPointerCapture(event.pointerId);

    const move = moveEvent => {
      const rows = Array.from(document.querySelectorAll(".modal-player-row"))
        .filter(candidate => candidate !== row);
      const target = rows.find(candidate => {
        const rect = candidate.getBoundingClientRect();
        return moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom;
      });
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const afterTarget = moveEvent.clientY > rect.top + rect.height / 2;
      target.parentElement.insertBefore(row, afterTarget ? target.nextSibling : target);
      updateModalPlayerLabels();
    };

    const stop = () => {
      row.classList.remove("dragging");
      draggedModalPlayerRow = null;
      updateModalSitCheckboxes();
      updateModalPlayerLabels();
      updateAddPlayerButton();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
  }

  function handleModalGameTypeChange() {
    const mode = document.getElementById("modalHanded").value;
    const players = getModalPlayers();
    const playerCount = populateModalPlayerCountOptions(mode, defaultPlayerCountForMode(mode));
    updateRuleSettingsAvailability(mode);
    renderModalPlayerInputs(playerCount, players);
  }

  function handleModalPlayerCountChange() {
    const settings = currentModalGameSettings();
    renderModalPlayerInputs(settings.playerCount, getModalPlayers());
  }

  function gameMetadata(game) {
    const handCount = Array.isArray(game.history) ? game.history.length : 0;
    const handed = gameTypeLabel(game);
    const lastPlayed = game.updatedAt ? new Date(game.updatedAt).toLocaleString() : "never";
    return `${handed} · ${handCount} hands · Last played ${lastPlayed}`;
  }

  function renderGamesList() {
    const list = document.getElementById("gamesList");
    list.innerHTML = "";
    const games = sortedGames();
    if (games.length === 0) {
      list.innerHTML = `<div class="games-empty">No saved games.</div>`;
      return;
    }
    games.forEach(game => {
      const isActive = game.id === appData.activeGameId;
      list.innerHTML += `
        <button class="game-row ${isActive ? "active" : ""}" type="button" onclick="switchGame('${escapeAttribute(game.id)}')">
          <span class="game-row-main">
            <span class="game-row-name">${escapeAttribute(displayGameName(game))}</span>
            <span class="game-row-meta">${escapeAttribute(gameMetadata(game))}</span>
          </span>
          <span class="game-delete-button" role="button" tabindex="0" aria-label="Delete ${escapeAttribute(displayGameName(game))}" onclick="promptDeleteGame(event, '${escapeAttribute(game.id)}')">🗑</span>
        </button>
      `;
    });
  }

  function switchGame(gameId) {
    const nextGame = appData.games.find(game => game.id === gameId);
    if (!nextGame || nextGame.id === appData.activeGameId) {
      closeGamesModal();
      return;
    }
    appData.activeGameId = nextGame.id;
    state = nextGame;
    normalizeCurrentGameState();
    saveState();
    closeGamesModal();
    updateOutcomeOptions();
    updateStandings();
  }

  function promptDeleteGame(event, gameId) {
    event.stopPropagation();
    const game = appData.games.find(candidate => candidate.id === gameId);
    if (!game) return;
    pendingDeleteGameId = gameId;
    document.getElementById("deleteGameMessage").textContent = `Delete "${displayGameName(game)}"?`;
    document.getElementById("deleteGameModal").hidden = false;
  }

  function confirmDeleteGame() {
    if (!pendingDeleteGameId) return;
    const deletingActive = pendingDeleteGameId === appData.activeGameId;
    appData.games = appData.games.filter(game => game.id !== pendingDeleteGameId);
    pendingDeleteGameId = null;
    document.getElementById("deleteGameModal").hidden = true;

    if (deletingActive) {
      if (appData.games.length > 0) {
        const nextGame = sortedGames()[0];
        appData.activeGameId = nextGame.id;
        state = nextGame;
        normalizeCurrentGameState();
      } else {
        appData.activeGameId = null;
        state = createRuntimeDraftGame();
      }
    }

    saveState();
    renderGamesList();
    updateOutcomeOptions();
    updateStandings();

    if (!hasSavedGame()) {
      closeGamesModal();
      openNewGameModal();
    }
  }

  function saveModal(event) {
    event.preventDefault();
    const modalPlayers = getModalPlayers();
    const nameInput = document.getElementById("modalGameName");
    const gameName = nameInput.value.trim() || (modalMode === "new" ? modalDefaultGameName : "");
    if (!gameName) {
      nameInput.value = "";
      if (nameInput.focus) nameInput.focus();
      if (nameInput.reportValidity) nameInput.reportValidity();
      return;
    }

    if (modalMode === "new") {
      const mode = currentModalGameSettings();
      const newGame = createGame({
        name: gameName,
        mode: mode.mode,
        handed: mode.handed,
        playerCount: mode.playerCount,
        players: modalPlayers,
        roles: { pickerId: null, partnerId: null, satIds: [] },
        doubleOnBump: doubleOnBumpAllowed({ mode: mode.mode }) && document.getElementById("doubleOnBumpCheckbox").checked,
        noTrickPartnerDoesntLose: noTrickPartnerRuleAllowed({ mode: mode.mode }) && document.getElementById("noTrickPartnerCheckbox").checked
      });
      appData.games.push(newGame);
      appData.activeGameId = newGame.id;
      state = newGame;
      storeSatIds(defaultSatIds());
    } else if (modalMode === "settings") {
      const previousPlayerIds = activePlayerIds();
      const previousSittingCount = sittingPlayerCount();
      const previousSatIds = satIds();
      const nextPlayerCount = getModalPlayerCount();
      const nextActivePlayers = modalPlayers.slice(0, nextPlayerCount);
      const addedPlayerIds = nextActivePlayers
        .map(player => player.id)
        .filter(id => !previousPlayerIds.includes(id));
      state.players = modalPlayers;
      state.playerCount = nextPlayerCount;
      state.fixedSatIds = getModalFixedSats();
      const nextSittingCount = sittingPlayerCount();
      const addedSittingSlots = Math.max(0, nextSittingCount - previousSittingCount);
      if (addedSittingSlots > 0 && addedPlayerIds.length > 0) {
        storeSatIds(previousSatIds.concat(addedPlayerIds.slice(0, addedSittingSlots)));
      }
      state.name = gameName;
      if (fixedSatIds().includes(state.roles.pickerId)) {
        state.roles.pickerId = null;
      }
      if (fixedSatIds().includes(state.roles.partnerId)) {
        state.roles.partnerId = null;
      }
      state.doubleOnBump = doubleOnBumpAllowed() && document.getElementById("doubleOnBumpCheckbox").checked;
      state.noTrickPartnerDoesntLose = noTrickPartnerRuleAllowed() && document.getElementById("noTrickPartnerCheckbox").checked;
      normalizeSatRoles();
    }
    state.updatedAt = nowIso();

    closeModal();
    saveState();
    updateOutcomeOptions();
    updateStandings();
  }

  function isHandReadyToSubmit() {
    return state.roles.pickerId !== null && satIds().length === sittingPlayerCount();
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
    instruction.textContent = hasPartnerRole()
      ? "Tap a player for Picker, then optionally tap another for Partner."
      : "Tap a player to assign Picker.";
  }

  function handleCardTap(index) {
    if (isFixedSat(index)) {
      return;
    }
    const playerId = playerIdAt(index);
    if (!playerId) {
      return;
    }

    const sittingCount = sittingPlayerCount();
    const hasPartner = hasPartnerRole();

    if (state.roles.pickerId === playerId) {
      state.roles.pickerId = null;
      if (hasPartner) {
        if (state.roles.partnerId !== null) state.roles.partnerId = null;
        state.roles.partnerId = playerId;
      } else if (sittingCount > 0 && satIds().length < sittingCount) {
        const sats = satIds();
        sats.push(playerId);
        storeSatIds(sats);
      }
    } else if (state.roles.partnerId === playerId) {
      state.roles.partnerId = null;
      if (sittingCount > 0) {
        const sats = satIds().filter(satId => satId !== playerId);
        if (sats.length < sittingCount) {
          sats.push(playerId);
          storeSatIds(sats);
        }
      }
    } else if (isSatOut(index)) {
      storeSatIds(satIds().filter(satId => satId !== playerId));
    } else {
      if (state.roles.pickerId === null) {
        state.roles.pickerId = playerId;
      } else if (gameMode() === "cut-throat") {
        state.roles.pickerId = playerId;
      } else if (hasPartner && state.roles.partnerId === null) {
        state.roles.partnerId = playerId;
      } else if (sittingCount > 0 && satIds().length < sittingCount) {
        const sats = satIds();
        sats.push(playerId);
        storeSatIds(sats);
      }
    }

    saveState();
    updateStandings();
  }

  function openEditHandModal(historyIndex) {
    const hand = state.history[historyIndex];
    if (!hand || hand.pickerId === undefined) {
      return;
    }

    editHandIndex = historyIndex;
    editHandDraft = {
      pickerId: hand.pickerId,
      partnerId: hasPartnerRole() && hand.partnerId !== undefined ? hand.partnerId : null,
      satIds: Array.isArray(hand.satIds) ? hand.satIds.slice() : [],
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
    const playerId = playerIdAt(index);
    return playerId !== null && editHandDraft.satIds.includes(playerId);
  }

  function storeEditDraftSats(ids) {
    editHandDraft.satIds = validPlayerIds(ids).slice(0, sittingPlayerCount());
  }

  function handleEditCardTap(index) {
    if (!editHandDraft) {
      return;
    }
    const playerId = playerIdAt(index);
    if (!playerId) {
      return;
    }

    const sittingCount = sittingPlayerCount();
    const hasPartner = hasPartnerRole();

    if (editHandDraft.pickerId === playerId) {
      editHandDraft.pickerId = null;
      if (hasPartner) {
        if (editHandDraft.partnerId !== null) editHandDraft.partnerId = null;
        editHandDraft.partnerId = playerId;
      } else if (sittingCount > 0 && editHandDraft.satIds.length < sittingCount) {
        editHandDraft.satIds.push(playerId);
      }
    } else if (editHandDraft.partnerId === playerId) {
      editHandDraft.partnerId = null;
      if (sittingCount > 0) {
        const sats = editHandDraft.satIds.filter(satId => satId !== playerId);
        if (sats.length < sittingCount) {
          sats.push(playerId);
        }
        storeEditDraftSats(sats);
      }
    } else if (editDraftHasSat(index)) {
      storeEditDraftSats(editHandDraft.satIds.filter(satId => satId !== playerId));
    } else {
      if (editHandDraft.pickerId === null) {
        editHandDraft.pickerId = playerId;
      } else if (gameMode() === "cut-throat") {
        editHandDraft.pickerId = playerId;
      } else if (hasPartner && editHandDraft.partnerId === null) {
        editHandDraft.partnerId = playerId;
      } else if (sittingCount > 0 && editHandDraft.satIds.length < sittingCount) {
        editHandDraft.satIds.push(playerId);
      }
    }

    if (!hasPartnerRole()) {
      editHandDraft.partnerId = null;
    }
    renderEditHandPlayers();
  }

  function renderEditHandPlayers() {
    const grid = document.getElementById("editHandPlayersGrid");
    const count = state.playerCount;
    grid.style.setProperty("--mobile-player-columns", Math.ceil(count / 2));
    grid.style.setProperty("--player-count", count);
    grid.innerHTML = "";

    for (let i = 0; i < count; i++) {
      let cardClass = "";
      let badgeHtml = "";

      const playerId = playerIdAt(i);
      if (editHandDraft.pickerId === playerId) {
        cardClass = "picker";
        badgeHtml = `<div class="role-badge badge-picker">Picker</div>`;
      } else if (editHandDraft.partnerId === playerId) {
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
      editHandDraft.pickerId === null || editHandDraft.satIds.length !== sittingPlayerCount();
  }

  function saveEditedHand(event) {
    event.preventDefault();
    if (!editHandDraft || editHandDraft.pickerId === null || editHandDraft.satIds.length !== sittingPlayerCount()) {
      return;
    }

    const hand = state.history[editHandIndex];
    const outcome = document.getElementById("editOutcomeSelect").value;
    const multiplier = parseInt(document.getElementById("editMultiplierSelect").value);
    const partnerId = hasPartnerRole() && editHandDraft.partnerId !== null ? editHandDraft.partnerId : null;
    const satIdsForHand = editHandDraft.satIds.slice();
    const deltas = calculateHand({
      picker: editHandDraft.pickerId,
      partner: partnerId,
      sats: satIdsForHand,
      outcome,
      multiplier,
      gameSettings: state
    });

    state.history[editHandIndex] = {
      ...hand,
      pickerId: editHandDraft.pickerId,
      partnerId,
      satIds: satIdsForHand,
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

    const pickerId = state.roles.pickerId;
    const partnerId = state.roles.partnerId;
    const currentSatIds = satIds();

    const outcome = document.getElementById("outcomeSelect").value;
    const mult = parseInt(document.getElementById("multiplierSelect").value);
    const effectivePartnerId = hasPartnerRole() && partnerId !== null ? partnerId : null;
    const deltas = calculateHand({
      picker: pickerId,
      partner: effectivePartnerId,
      sats: currentSatIds,
      outcome,
      multiplier: mult,
      gameSettings: state
    });

    state.history.push({
      id: createId("hand"),
      deltas,
      pickerId,
      partnerId: effectivePartnerId,
      satIds: currentSatIds,
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
    const player = playerAt(index);
    return player && player.name.trim() !== "" 
      ? player.name 
      : `Player ${index + 1}`;
  }

  function updateStandings() {
    const count = state.playerCount;
    const players = activePlayers();
    const totals = {};
    players.forEach(player => {
      totals[player.id] = 0;
    });
    document.getElementById("activeGameName").textContent = hasSavedGame() ? displayGameName(state) : "";
    updateRoleInstruction();

    state.history.forEach(hand => {
      players.forEach(player => {
        totals[player.id] += hand.deltas[player.id] || 0;
      });
    });

    // Render Standings Grid
    const totalsGrid = document.getElementById("totalsGrid");
    totalsGrid.style.setProperty("--mobile-player-columns", Math.ceil(count / 2));
    totalsGrid.style.setProperty("--player-count", count);
    totalsGrid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const playerId = playerIdAt(i);
      const val = totals[playerId] || 0;
      const cls = val > 0 ? "pos" : val < 0 ? "neg" : "";
      
      let cardClass = "";
      let badgeHtml = "";

      if (state.roles.pickerId === playerId) {
        cardClass = "picker";
        badgeHtml = `<div class="role-badge badge-picker">Picker</div>`;
      } else if (state.roles.partnerId === playerId) {
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
    const runningTotals = {};
    players.forEach(player => {
      runningTotals[player.id] = 0;
    });
    const historyRows = state.history.map((hand, hIdx) => {
      players.forEach(player => {
        runningTotals[player.id] += hand.deltas[player.id] || 0;
      });

      return {
        hand,
        handNumber: hIdx + 1,
        totals: { ...runningTotals }
      };
    });
    if (state.historyNewestFirst) {
      historyRows.reverse();
    }

    historyRows.forEach(({ hand, handNumber, totals }) => {
      let tr = `<tr><td><button class="inline-button" type="button" onclick="openEditHandModal(${handNumber - 1})">${handNumber}</button></td>`;
      for (let i = 0; i < count; i++) {
        const playerId = playerIdAt(i);
        let val = state.historyShowTotals ? totals[playerId] || 0 : hand.deltas[playerId] || 0;
        let cls = val > 0 ? "pos" : val < 0 ? "neg" : "";
        if (hand.pickerId === playerId) {
          cls += " history-picker-cell";
        } else if (hand.partnerId === playerId) {
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
