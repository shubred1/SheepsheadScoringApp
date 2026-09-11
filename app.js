  const STORAGE_KEY = "sheepshead_scorekeeper_data";
  const APP_VERSION = self.SHEEPSHEAD_APP_VERSION;
  const DATA_VERSION = 3;
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
    return game.players.slice(0, game.gameType);
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

  function defaultSatIds(count = state.gameType, handed = state.handed, players = state.players) {
    return defaultSatIndexes(count, handed)
      .map(index => players[index])
      .filter(Boolean)
      .map(player => player.id);
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
      fixedSatIds: [],
      doubleOnBump: true,
      noTrickPartnerDoesntLose: true,
      roles: { pickerId: null, partnerId: null, satIds: [] },
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
    state.handed = [3, 5].includes(parseInt(state.handed)) ? parseInt(state.handed) : 5;
    state.gameType = [3, 4, 5, 6, 7].includes(parseInt(state.gameType)) ? parseInt(state.gameType) : 6;
    state.doubleOnBump = state.doubleOnBump !== false;
    state.noTrickPartnerDoesntLose = state.noTrickPartnerDoesntLose !== false;
    if (state.gameType < state.handed || state.gameType > state.handed + 2) {
      state.handed = state.gameType <= 4 ? 3 : 5;
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
    state.fixedSatIds = Array.isArray(state.fixedSatIds) ? state.fixedSatIds : [];
    state.fixedSatIds = fixedSatIds();

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
    const players = activePlayers(gameSettings);
    const playerIds = players.map(player => player.id);
    const deltas = {};
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
      playerIds.forEach(id => {
        if (id !== picker && !sats.includes(id)) {
          deltas[id] = defPts;
          pickerTotal -= defPts;
        }
      });
      deltas[picker] = pickerTotal;
    } else {
      deltas[picker] = pPts;
      deltas[partner] = outcome === "schwarz-loss" && gameSettings.noTrickPartnerDoesntLose ? 0 : ptPts;
      playerIds.forEach(id => {
        if (id !== picker && id !== partner && !sats.includes(id)) {
          deltas[id] = defPts;
        }
      });
      if (outcome === "schwarz-loss" && gameSettings.noTrickPartnerDoesntLose) {
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
    return Math.max(0, state.gameType - state.handed);
  }

  function defaultSatIndexes(count = state.gameType, handed = state.handed) {
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
    for (let step = 0; step < state.gameType; step++) {
      next = (next + 1) % state.gameType;
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
    if (state.handed === 3) {
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

    for (let i = 0; i < state.gameType && nextSats.length < sittingCount; i++) {
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
    const modalPlayers = Array.from({ length: count }, (_, index) => normalizePlayer(players[index]));

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
        <div class="modal-player-main">
          <span class="modal-player-position">${i + 1}</span>
          ${modalMode === "settings" ? `
            <button
              class="reorder-handle"
              type="button"
              aria-label="Drag to reorder Player ${i + 1}"
              title="Drag to reorder"
              onpointerdown="startModalPointerReorder(event)"
            >≡</button>
          ` : ""}
          <label class="modal-player-name-label">
            <span class="modal-player-label-text">Player ${i + 1}</span>
            <input 
              class="modal-player-name"
              type="text" 
              placeholder="Player ${i + 1}" 
              value="${escapeAttribute(val)}" 
            />
          </label>
          ${modalMode === "settings" ? `
            <div class="modal-reorder-controls">
              <button class="btn-secondary modal-move-button" type="button" onclick="moveModalPlayerRow(this, -1)" aria-label="Move Player ${i + 1} up">↑</button>
              <button class="btn-secondary modal-move-button" type="button" onclick="moveModalPlayerRow(this, 1)" aria-label="Move Player ${i + 1} down">↓</button>
            </div>
          ` : ""}
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
  }

  function getModalPlayers() {
    const players = emptyPlayers();
    document.querySelectorAll(".modal-player-row").forEach((row, index) => {
      const input = row.querySelector(".modal-player-name");
      players[index] = {
        id: row.dataset.playerId || createId("player"),
        name: input ? input.value : ""
      };
    });
    return players;
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
      const position = row.querySelector(".modal-player-position");
      const label = row.querySelector(".modal-player-label-text");
      const input = row.querySelector(".modal-player-name");
      const handle = row.querySelector(".reorder-handle");
      const upButton = row.querySelector(".modal-move-button:first-child");
      const downButton = row.querySelector(".modal-move-button:last-child");
      if (position) position.textContent = String(index + 1);
      if (label) label.textContent = `Player ${index + 1}`;
      if (input) input.placeholder = `Player ${index + 1}`;
      if (handle) handle.setAttribute("aria-label", `Drag to reorder Player ${index + 1}`);
      if (upButton) upButton.disabled = index === 0;
      if (downButton) downButton.disabled = index === document.querySelectorAll(".modal-player-row").length - 1;
    });
  }

  function moveModalPlayerRow(control, direction) {
    const row = control.closest(".modal-player-row");
    if (!row) return;
    const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) {
      row.parentElement.insertBefore(row, sibling);
    } else {
      row.parentElement.insertBefore(sibling, row);
    }
    updateModalSitCheckboxes();
    updateModalPlayerLabels();
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
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
  }

  function handleModalGameTypeChange() {
    const mode = parseGameModeValue(document.getElementById("modalGameType").value);
    renderModalPlayerInputs(mode.gameType, getModalPlayers());
  }

  function saveModal(event) {
    event.preventDefault();
    const modalPlayers = getModalPlayers();

    if (modalMode === "new") {
      const mode = parseGameModeValue(document.getElementById("modalGameType").value);
      const newGame = createGame({
        handed: mode.handed,
        gameType: mode.gameType,
        players: modalPlayers,
        roles: { pickerId: null, partnerId: null, satIds: [] },
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
      storeSatIds(defaultSatIds());
    } else if (modalMode === "settings") {
      state.players = modalPlayers;
      state.fixedSatIds = getModalFixedSats();
      if (fixedSatIds().includes(state.roles.pickerId)) {
        state.roles.pickerId = null;
      }
      if (fixedSatIds().includes(state.roles.partnerId)) {
        state.roles.partnerId = null;
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
    instruction.textContent = "Tap player cards to assign roles.";
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
    const hasPartner = state.handed === 5;

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
      partnerId: state.handed === 5 && hand.partnerId !== undefined ? hand.partnerId : null,
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
    const hasPartner = state.handed === 5;

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
      } else if (hasPartner && editHandDraft.partnerId === null) {
        editHandDraft.partnerId = playerId;
      } else if (sittingCount > 0 && editHandDraft.satIds.length < sittingCount) {
        editHandDraft.satIds.push(playerId);
      }
    }

    if (state.handed === 3) {
      editHandDraft.partnerId = null;
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
    const partnerId = state.handed === 5 && editHandDraft.partnerId !== null ? editHandDraft.partnerId : null;
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
    const effectivePartnerId = state.handed === 5 && partnerId !== null ? partnerId : null;
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
    const count = state.gameType;
    const players = activePlayers();
    const totals = {};
    players.forEach(player => {
      totals[player.id] = 0;
    });
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
