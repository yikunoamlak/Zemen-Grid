const fs = require('node:fs');
const path = require('node:path');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray
} = require('electron');
const { autoUpdater } = require('electron-updater');

app.setName('Zemen Grid');
app.setAppUserModelId('com.zemengrid.desktop');

const DEFAULT_SETTINGS = Object.freeze({
  accent: '#39d353',
  alwaysOnTop: true,
  clockHoverDetails: true,
  clockShowDate: true,
  clockShowHeader: false,
  clockShowSeconds: true,
  clockVisible: true,
  controllerOnLaunch: true,
  deadlineIso: '',
  deadlineTitle: '',
  gridHoverDetails: true,
  gridShowHeader: false,
  gridShowLegend: false,
  gridShowMonths: true,
  gridShowWeekdays: true,
  gridView: 'year',
  gridVisible: true,
  language: 'am',
  theme: 'system'
});

const DEFAULT_STATE = Object.freeze({
  schemaVersion: 2,
  legacyMigrated: false,
  settings: DEFAULT_SETTINGS,
  notes: {},
  bounds: {}
});

const windows = {
  controller: null,
  grid: null,
  clock: null,
  note: null
};

let state = null;
let statePath = '';
let tray = null;
let saveTimer = null;
let isQuitting = false;
let updateCheckTimer = null;
let manualUpdateCheck = false;
let updatePromptOpen = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeSettings(value) {
  const next = { ...DEFAULT_SETTINGS, ...(value || {}) };
  const booleans = [
    'alwaysOnTop',
    'clockHoverDetails',
    'clockShowDate',
    'clockShowHeader',
    'clockShowSeconds',
    'clockVisible',
    'controllerOnLaunch',
    'gridHoverDetails',
    'gridShowHeader',
    'gridShowLegend',
    'gridShowMonths',
    'gridShowWeekdays',
    'gridVisible'
  ];
  booleans.forEach((key) => {
    next[key] = Boolean(next[key]);
  });
  next.accent = /^#[0-9a-f]{6}$/i.test(next.accent)
    ? next.accent.toLowerCase()
    : DEFAULT_SETTINGS.accent;
  next.theme = ['dark', 'light', 'system'].includes(next.theme) ? next.theme : 'system';
  next.language = next.language === 'en' ? 'en' : 'am';
  next.gridView = ['year', 'month', 'week'].includes(next.gridView) ? next.gridView : 'year';
  next.deadlineIso = /^\d{4}-\d{2}-\d{2}$/.test(next.deadlineIso) ? next.deadlineIso : '';
  next.deadlineTitle = String(next.deadlineTitle || '').slice(0, 60);
  return next;
}

function sanitizeState(value) {
  const candidate = value && typeof value === 'object' ? value : {};
  return {
    schemaVersion: 2,
    legacyMigrated: Boolean(candidate.legacyMigrated),
    settings: sanitizeSettings(candidate.settings),
    notes:
      candidate.notes && typeof candidate.notes === 'object' && !Array.isArray(candidate.notes)
        ? candidate.notes
        : {},
    bounds:
      candidate.bounds && typeof candidate.bounds === 'object' && !Array.isArray(candidate.bounds)
        ? candidate.bounds
        : {}
  };
}

function loadState() {
  statePath = path.join(app.getPath('userData'), 'zemen-state.json');
  try {
    state = sanitizeState(JSON.parse(fs.readFileSync(statePath, 'utf8')));
  } catch {
    state = sanitizeState(DEFAULT_STATE);
  }
}

function writeState() {
  if (!state || !statePath) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Could not persist Zemen Grid state:', error);
  }
}

function scheduleStateWrite() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeState, 160);
}

function publicState() {
  return clone(state);
}

function broadcastState() {
  const payload = publicState();
  Object.values(windows).forEach((win) => {
    if (win && !win.isDestroyed()) win.webContents.send('state:changed', payload);
  });
  refreshTrayMenu();
}

function commitState({ visibility = true } = {}) {
  state.settings = sanitizeSettings(state.settings);
  scheduleStateWrite();
  applyWindowSettings();
  if (visibility) applyWidgetVisibility();
  broadcastState();
}

function patchSettings(patch) {
  if (!patch || typeof patch !== 'object') return publicState();
  const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
  Object.entries(patch).forEach(([key, value]) => {
    if (allowed.has(key)) state.settings[key] = value;
  });
  commitState();
  return publicState();
}

function isUsableBounds(bounds) {
  if (!bounds || !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(bounds[key]))) {
    return false;
  }
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

function defaultBounds(type) {
  const area = screen.getPrimaryDisplay().workArea;
  if (type === 'grid') {
    const width = Math.min(1260, Math.max(360, area.width - 48));
    return {
      width,
      height: 220,
      x: area.x + area.width - width - 24,
      y: area.y + area.height - 244
    };
  }
  if (type === 'clock') {
    return {
      width: 560,
      height: 108,
      x: area.x + area.width - 584,
      y: area.y + area.height - 356
    };
  }
  return {
    width: 520,
    height: Math.min(800, area.height - 60),
    x: area.x + Math.round((area.width - 520) / 2),
    y: area.y + Math.max(30, Math.round((area.height - Math.min(800, area.height - 60)) / 2))
  };
}

function resolvedBounds(type) {
  return isUsableBounds(state.bounds[type]) ? state.bounds[type] : defaultBounds(type);
}

function secureWebPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    devTools: !app.isPackaged
  };
}

function guardNavigation(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
}

function rememberBounds(win, type) {
  const saveBounds = () => {
    if (!win || win.isDestroyed() || win.isMaximized() || win.isMinimized()) return;
    state.bounds[type] = win.getBounds();
    scheduleStateWrite();
  };
  win.on('move', saveBounds);
  win.on('resize', saveBounds);
}

function createControllerWindow() {
  if (windows.controller && !windows.controller.isDestroyed()) return windows.controller;
  const bounds = resolvedBounds('controller');
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 460,
    minHeight: 600,
    title: 'Zemen Grid Controls',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#202020',

    ...(process.platform === 'win32'
      ? {
          backgroundMaterial: 'mica'
        }
      : {}),

    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: secureWebPreferences()
  });
  windows.controller = win;
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  guardNavigation(win);
  rememberBounds(win, 'controller');
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
  });
  win.on('closed', () => {
    windows.controller = null;
  });
  return win;
}

function createWidgetWindow(type) {
  if (windows[type] && !windows[type].isDestroyed()) return windows[type];
  const isGrid = type === 'grid';
  const bounds = resolvedBounds(type);
  const win = new BrowserWindow({
    ...bounds,
    minWidth: isGrid ? 320 : 300,
    minHeight: isGrid ? 104 : 80,
    maxWidth: 2600,
    maxHeight: isGrid ? 1500 : 240,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: state.settings.alwaysOnTop,
    hasShadow: true,
    webPreferences: secureWebPreferences()
  });
  windows[type] = win;
  win.loadFile(path.join(__dirname, '..', isGrid ? 'grid.html' : 'clock.html'));
  guardNavigation(win);
  rememberBounds(win, type);
  win.webContents.on('context-menu', () => showWidgetMenu(type, win));
  win.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    win.hide();
    state.settings[`${type}Visible`] = false;
    commitState();
  });
  win.on('closed', () => {
    windows[type] = null;
  });
  return win;
}

function fitWidgetWindow(event, type, requestedHeight) {
  if (!['grid', 'clock'].includes(type)) return null;
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win !== windows[type] || win.isDestroyed()) return null;
  const minimum = type === 'grid' ? 104 : 80;
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const maximum = Math.min(type === 'grid' ? 1500 : 240, Math.max(minimum, area.height - 16));
  const height = Math.round(Math.max(minimum, Math.min(maximum, Number(requestedHeight) || minimum)));
  if (Math.abs(bounds.height - height) <= 2) return bounds;
  const next = { ...bounds, height };
  if (next.y + height > area.y + area.height) {
    next.y = Math.max(area.y, area.y + area.height - height);
  }
  win.setBounds(next, false);
  state.bounds[type] = win.getBounds();
  scheduleStateWrite();
  return state.bounds[type];
}

function openNoteWindow(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return;
  if (windows.note && !windows.note.isDestroyed()) {
    if (windows.note.isMinimized()) windows.note.restore();
    windows.note.show();
    windows.note.focus();
    return;
  }
  const parent =
    windows.grid?.isVisible() ? windows.grid : windows.controller?.isVisible() ? windows.controller : null;
  const win = new BrowserWindow({
    width: 470,
    height: 470,
    minWidth: 400,
    minHeight: 410,
    title: 'Zemen Day Note',
    parent: parent || undefined,
    modal: false,
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: state.settings.alwaysOnTop,
    backgroundColor: '#202020',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: secureWebPreferences()
  });
  windows.note = win;
  win.loadFile(path.join(__dirname, '..', 'note.html'), { query: { date: iso } });
  guardNavigation(win);
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });
  win.on('closed', () => {
    windows.note = null;
  });
}

function showController() {
  const controller = createControllerWindow();
  if (controller.isMinimized()) controller.restore();
  controller.show();
  controller.focus();
}

function showWidget(type) {
  const win = createWidgetWindow(type);
  win.showInactive();
}

function applyWidgetVisibility() {
  ['grid', 'clock'].forEach((type) => {
    const visible = state.settings[`${type}Visible`];
    const win = createWidgetWindow(type);
    if (visible) {
      if (!win.isVisible()) win.showInactive();
    } else if (win.isVisible()) {
      win.hide();
    }
  });
}

function applyWindowSettings() {
  ['grid', 'clock'].forEach((type) => {
    const win = windows[type];
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
    }
  });
  if (windows.note && !windows.note.isDestroyed()) {
    windows.note.setAlwaysOnTop(state.settings.alwaysOnTop, 'floating');
  }
}

function showWidgetMenu(type, win) {
  const isGrid = type === 'grid';
  const settings = state.settings;
  const patch = (key, value) => patchSettings({ [key]: value });
  const template = [
    {
      label: 'Open Zemen controls',
      click: showController
    },
    { type: 'separator' },
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: settings.alwaysOnTop,
      click: (item) => patch('alwaysOnTop', item.checked)
    }
  ];

  if (isGrid) {
    template.push(
      {
        label: 'View',
        submenu: ['year', 'month', 'week'].map((view) => ({
          label: view[0].toUpperCase() + view.slice(1),
          type: 'radio',
          checked: settings.gridView === view,
          click: () => patch('gridView', view)
        }))
      },
      {
        label: 'Month labels',
        type: 'checkbox',
        checked: settings.gridShowMonths,
        click: (item) => patch('gridShowMonths', item.checked)
      },
      {
        label: 'Weekday labels',
        type: 'checkbox',
        checked: settings.gridShowWeekdays,
        click: (item) => patch('gridShowWeekdays', item.checked)
      },
      {
        label: 'Legend',
        type: 'checkbox',
        checked: settings.gridShowLegend,
        click: (item) => patch('gridShowLegend', item.checked)
      },
      {
        label: 'Widget header',
        type: 'checkbox',
        checked: settings.gridShowHeader,
        click: (item) => patch('gridShowHeader', item.checked)
      },
      {
        label: 'Hover details',
        type: 'checkbox',
        checked: settings.gridHoverDetails,
        click: (item) => patch('gridHoverDetails', item.checked)
      }
    );
  } else {
    template.push(
      {
        label: 'Show Ethiopian date',
        type: 'checkbox',
        checked: settings.clockShowDate,
        click: (item) => patch('clockShowDate', item.checked)
      },
      {
        label: 'Show seconds',
        type: 'checkbox',
        checked: settings.clockShowSeconds,
        click: (item) => patch('clockShowSeconds', item.checked)
      },
      {
        label: 'Widget header',
        type: 'checkbox',
        checked: settings.clockShowHeader,
        click: (item) => patch('clockShowHeader', item.checked)
      },
      {
        label: 'Hover details',
        type: 'checkbox',
        checked: settings.clockHoverDetails,
        click: (item) => patch('clockHoverDetails', item.checked)
      }
    );
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Theme',
      submenu: ['system', 'dark', 'light'].map((theme) => ({
        label: theme[0].toUpperCase() + theme.slice(1),
        type: 'radio',
        checked: settings.theme === theme,
        click: () => patch('theme', theme)
      }))
    },
    {
      label: `Hide ${isGrid ? 'grid' : 'clock'} widget`,
      click: () => patch(`${type}Visible`, false)
    },
    { type: 'separator' },
    {
      label: 'Quit Zemen Grid',
      click: () => app.quit()
    }
  );

  Menu.buildFromTemplate(template).popup({ window: win });
}

function refreshTrayMenu() {
  if (!tray || !state) return;
  const settings = state.settings;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Zemen controls', click: showController },
      { type: 'separator' },
      {
        label: 'Grid widget',
        type: 'checkbox',
        checked: settings.gridVisible,
        click: (item) => patchSettings({ gridVisible: item.checked })
      },
      {
        label: 'Clock widget',
        type: 'checkbox',
        checked: settings.clockVisible,
        click: (item) => patchSettings({ clockVisible: item.checked })
      },
      {
        label: 'Always on top',
        type: 'checkbox',
        checked: settings.alwaysOnTop,
        click: (item) => patchSettings({ alwaysOnTop: item.checked })
      },
      { type: 'separator' },
      { label: 'Check for updates', click: () => checkForUpdates(true) },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(__dirname, '..', 'assets', 'icon.png'))
    .resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Zemen Grid');
  tray.on('click', showController);
  refreshTrayMenu();
}

function updaterLog(message) {
  console.log(`[auto-updater] ${message}`);
}

function getUpdateParentWindow() {
  return windows.controller || BrowserWindow.getAllWindows()[0] || null;
}

function showUpdateMessage(title, message) {
  if (updatePromptOpen) return;
  updatePromptOpen = true;
  const parent = getUpdateParentWindow();
  dialog.showMessageBox(parent, {
    type: 'info',
    buttons: ['OK'],
    title,
    message
  }).finally(() => { updatePromptOpen = false; });
}

function checkForUpdates(manual = false) {
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch(err => {
    updaterLog(`check error: ${err.message}`);
    if (manual) showUpdateMessage('Update Check', `Could not check for updates:\n${err.message}`);
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = {
    info: (msg) => updaterLog(`info: ${msg}`),
    warn: (msg) => updaterLog(`warn: ${msg}`),
    error: (msg) => updaterLog(`error: ${msg}`)
  };

  autoUpdater.on('checking-for-update', () => updaterLog('checking for update...'));
  autoUpdater.on('update-available', (info) => {
    updaterLog(`update available: ${info.version}`);
    if (manualUpdateCheck) {
      showUpdateMessage('Update Available', `Version ${info.version} is downloading and will install on quit.`);
    }
  });
  autoUpdater.on('update-not-available', (info) => {
    updaterLog(`update not available (latest: ${info.version})`);
    if (manualUpdateCheck) {
      showUpdateMessage('No Update', `You are up to date (${app.getVersion()}).`);
    }
  });
  autoUpdater.on('error', (err) => {
    updaterLog(`error: ${err.message}`);
    if (manualUpdateCheck) {
      showUpdateMessage('Update Error', `Update error:\n${err.message}`);
    }
  });
  autoUpdater.on('download-progress', (progress) => {
    updaterLog(`download progress: ${progress.percent.toFixed(1)}%`);
  });
  autoUpdater.on('update-downloaded', (info) => {
    updaterLog(`update downloaded: ${info.version}`);
    const parent = getUpdateParentWindow();
    if (updatePromptOpen) return;
    updatePromptOpen = true;
    dialog.showMessageBox(parent, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update Ready',
      message: `Version ${info.version} has been downloaded. Restart to apply the update?`
    }).then(({ response }) => {
      updatePromptOpen = false;
      if (response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    }).catch(() => { updatePromptOpen = false; });
  });

  setTimeout(() => checkForUpdates(), 10000);
  updateCheckTimer = setInterval(() => checkForUpdates(), 6 * 60 * 60 * 1000);
}

function registerIpc() {
  ipcMain.handle('state:get', () => publicState());
  ipcMain.handle('state:patch-settings', (_event, patch) => patchSettings(patch));
  ipcMain.handle('state:set-note', (_event, iso, note) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso))) return publicState();
    const text = String(note?.text || '').trim().slice(0, 2000);
    const level = Math.max(0, Math.min(4, Number(note?.level) || 0));
    if (!text && level === 0) delete state.notes[iso];
    else state.notes[iso] = { text, level, updatedAt: new Date().toISOString() };
    commitState({ visibility: false });
    return publicState();
  });
  ipcMain.handle('state:delete-note', (_event, iso) => {
    delete state.notes[String(iso)];
    commitState({ visibility: false });
    return publicState();
  });
  ipcMain.handle('state:migrate-legacy', (_event, legacy) => {
    if (state.legacyMigrated) return publicState();
    const previous = legacy?.settings || {};
    state.settings = {
      ...state.settings,
      accent: previous.accent || state.settings.accent,
      alwaysOnTop:
        typeof previous.alwaysOnTop === 'boolean'
          ? previous.alwaysOnTop
          : state.settings.alwaysOnTop,
      deadlineIso: previous.deadlineIso || '',
      deadlineTitle: previous.deadlineTitle || '',
      gridShowMonths:
        typeof previous.showMonths === 'boolean'
          ? previous.showMonths
          : state.settings.gridShowMonths,
      gridShowWeekdays:
        typeof previous.showWeekdays === 'boolean'
          ? previous.showWeekdays
          : state.settings.gridShowWeekdays,
      gridView: previous.viewMode || state.settings.gridView,
      language: previous.language || state.settings.language,
      theme: previous.surface || state.settings.theme
    };
    if (legacy?.notes && typeof legacy.notes === 'object') {
      state.notes = { ...legacy.notes, ...state.notes };
    }
    state.legacyMigrated = true;
    commitState();
    return publicState();
  });
  ipcMain.handle('window:show-controller', () => showController());
  ipcMain.handle('window:show-widget', (_event, type) => {
    if (!['grid', 'clock'].includes(type)) return;
    patchSettings({ [`${type}Visible`]: true });
    showWidget(type);
  });
  ipcMain.handle('window:hide-controller', () => windows.controller?.hide());
  ipcMain.handle('window:open-note', (_event, iso) => openNoteWindow(iso));
  ipcMain.handle('window:close-note', (event) => BrowserWindow.fromWebContents(event.sender)?.close());
  ipcMain.handle('window:fit-widget', (event, type, height) =>
    fitWidgetWindow(event, type, height)
  );
  ipcMain.handle('app:get-version', () => app.getVersion());
}

app.whenReady().then(() => {
  loadState();
  registerIpc();
  createControllerWindow();
  createWidgetWindow('grid');
  createWidgetWindow('clock');
  createTray();
  applyWindowSettings();
  applyWidgetVisibility();
  if (state.settings.controllerOnLaunch) showController();
  setupAutoUpdater();
});

app.on('activate', showController);

app.on('before-quit', () => {
  isQuitting = true;
  writeState();
  if (updateCheckTimer) clearInterval(updateCheckTimer);
});

app.on('window-all-closed', () => {
  // The tray owns the app lifecycle. Quit explicitly from its menu.
});
