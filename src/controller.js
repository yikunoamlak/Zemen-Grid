(function startController() {
  'use strict';

  const Calendar = window.ZemenCalendar;
  const api = window.zemen;
  const elements = Object.fromEntries(
    [
      'always-on-top',
      'app-version',
      'clear-deadline',
      'clock-hover-details',
      'clock-show-date',
      'clock-show-header',
      'clock-show-seconds',
      'clock-visible',
      'color-presets',
      'controller-on-launch',
      'current-ethiopian-year',
      'custom-color',
      'deadline-day',
      'deadline-month',
      'deadline-preview',
      'deadline-status',
      'deadline-title',
      'deadline-year',
      'grid-hover-details',
      'grid-show-header',
      'grid-show-legend',
      'grid-show-months',
      'grid-show-weekdays',
      'grid-visible',
      'save-deadline',
      'show-clock',
      'show-grid',
      'theme-control',
      'toast'
    ].map((id) => [
      id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()),
      document.getElementById(id)
    ])
  );

  let state = null;
  let toastTimer = null;

  function resolvedTheme() {
    if (state.settings.theme !== 'system') return state.settings.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme() {
    if (!state) return;
    document.body.dataset.theme = resolvedTheme();
    document.documentElement.style.setProperty('--accent', state.settings.accent);
  }

  function eraLabel() {
    return state.settings.language === 'en' ? 'E.C.' : 'ዓ.ም.';
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.add('hidden'), 1900);
  }

  function updateControlState() {
    if (!state) return;
    const settings = state.settings;
    applyTheme();
    elements.alwaysOnTop.checked = settings.alwaysOnTop;
    elements.clockHoverDetails.checked = settings.clockHoverDetails;
    elements.clockShowDate.checked = settings.clockShowDate;
    elements.clockShowHeader.checked = settings.clockShowHeader;
    elements.clockShowSeconds.checked = settings.clockShowSeconds;
    elements.clockVisible.checked = settings.clockVisible;
    elements.controllerOnLaunch.checked = settings.controllerOnLaunch;
    elements.customColor.value = settings.accent;
    elements.gridHoverDetails.checked = settings.gridHoverDetails;
    elements.gridShowHeader.checked = settings.gridShowHeader;
    elements.gridShowLegend.checked = settings.gridShowLegend;
    elements.gridShowMonths.checked = settings.gridShowMonths;
    elements.gridShowWeekdays.checked = settings.gridShowWeekdays;
    elements.gridVisible.checked = settings.gridVisible;

    document.querySelectorAll('[data-theme-value]').forEach((button) => {
      button.classList.toggle('active', button.dataset.themeValue === settings.theme);
    });
    document.querySelectorAll('[data-grid-view]').forEach((button) => {
      button.classList.toggle('active', button.dataset.gridView === settings.gridView);
    });
    document.querySelectorAll('[data-color]').forEach((button) => {
      button.classList.toggle('active', button.dataset.color.toLowerCase() === settings.accent);
    });

    const currentParts = Calendar.getEthiopianParts(new Date());
    elements.currentEthiopianYear.textContent = `${currentParts.year} ${eraLabel()}`;
    renderDeadlineStatus();
  }

  async function patchSettings(patch, message) {
    state = await api.patchSettings(patch);
    updateControlState();
    if (message) showToast(message);
  }

  function populateDeadlineMonths() {
    const selected = Number(elements.deadlineMonth.value) || 1;
    const fragment = document.createDocumentFragment();
    Calendar.getMonthNames(state.settings.language).forEach((name, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = `${index + 1} · ${name}`;
      fragment.append(option);
    });
    elements.deadlineMonth.replaceChildren(fragment);
    elements.deadlineMonth.value = String(Math.max(1, Math.min(13, selected)));
  }

  function syncDeadlineForm() {
    let date = Calendar.today();
    if (state.settings.deadlineIso) {
      try {
        date = Calendar.fromISODate(state.settings.deadlineIso);
      } catch {
        date = Calendar.today();
      }
    }
    const parts = Calendar.getEthiopianParts(date);
    populateDeadlineMonths();
    elements.deadlineTitle.value = state.settings.deadlineTitle;
    elements.deadlineYear.value = String(parts.year);
    elements.deadlineMonth.value = String(parts.month);
    elements.deadlineDay.value = String(parts.day);
    elements.clearDeadline.classList.toggle('hidden', !state.settings.deadlineIso);
    updateDeadlinePreview();
  }

  function getDeadlineDraft() {
    const year = Number(elements.deadlineYear.value);
    const month = Number(elements.deadlineMonth.value);
    const day = Number(elements.deadlineDay.value);
    const maxDay = Calendar.getMonthLength(year, month);
    elements.deadlineDay.max = String(maxDay);
    if (!Number.isInteger(day) || day < 1 || day > maxDay) {
      throw new RangeError(`Day must be between 1 and ${maxDay}`);
    }
    return Calendar.ethiopianToGregorian(year, month, day);
  }

  function updateDeadlinePreview() {
    try {
      const date = getDeadlineDraft();
      elements.deadlinePreview.textContent = `${Calendar.formatEthiopianShort(date, state.settings.language)} · ${Calendar.formatGregorian(date)}`;
      elements.saveDeadline.disabled = false;
    } catch (error) {
      elements.deadlinePreview.textContent = error.message || 'Choose a valid Ethiopian date';
      elements.saveDeadline.disabled = true;
    }
  }

  function renderDeadlineStatus() {
    if (!state.settings.deadlineIso) {
      elements.deadlineStatus.textContent = 'No deadline set';
      return;
    }
    try {
      const deadline = Calendar.fromISODate(state.settings.deadlineIso);
      const days = Calendar.diffDays(Calendar.today(), deadline);
      const title = state.settings.deadlineTitle || 'Deadline';
      if (days === 0) elements.deadlineStatus.textContent = `${title} is today`;
      else if (days > 0) elements.deadlineStatus.textContent = `${days} days to ${title}`;
      else elements.deadlineStatus.textContent = `${Math.abs(days)} days since ${title}`;
    } catch {
      elements.deadlineStatus.textContent = 'No deadline set';
    }
  }

  async function saveDeadline() {
    try {
      const date = getDeadlineDraft();
      await patchSettings(
        {
          deadlineIso: Calendar.toISODate(date),
          deadlineTitle: elements.deadlineTitle.value.trim().slice(0, 60)
        },
        'Deadline set'
      );
      syncDeadlineForm();
    } catch (error) {
      elements.deadlinePreview.textContent = error.message || 'Choose a valid date';
    }
  }

  async function migrateLegacyIfNeeded() {
    if (state.legacyMigrated) return;
    let settings = {};
    let notes = {};
    try {
      settings = JSON.parse(localStorage.getItem('zemen-grid:settings:v1') || '{}');
      notes = JSON.parse(localStorage.getItem('zemen-grid:notes:v1') || '{}');
    } catch {
      settings = {};
      notes = {};
    }
    state = await api.migrateLegacy({ settings, notes });
  }

  function bindEvents() {
    const toggleMap = new Map([
      [elements.alwaysOnTop, 'alwaysOnTop'],
      [elements.clockHoverDetails, 'clockHoverDetails'],
      [elements.clockShowDate, 'clockShowDate'],
      [elements.clockShowHeader, 'clockShowHeader'],
      [elements.clockShowSeconds, 'clockShowSeconds'],
      [elements.clockVisible, 'clockVisible'],
      [elements.controllerOnLaunch, 'controllerOnLaunch'],
      [elements.gridHoverDetails, 'gridHoverDetails'],
      [elements.gridShowHeader, 'gridShowHeader'],
      [elements.gridShowLegend, 'gridShowLegend'],
      [elements.gridShowMonths, 'gridShowMonths'],
      [elements.gridShowWeekdays, 'gridShowWeekdays'],
      [elements.gridVisible, 'gridVisible']
    ]);
    toggleMap.forEach((key, input) => {
      input.addEventListener('change', () => patchSettings({ [key]: input.checked }));
    });

    elements.showGrid.addEventListener('click', async () => {
      await api.showWidget('grid');
      showToast('Grid widget shown');
    });
    elements.showClock.addEventListener('click', async () => {
      await api.showWidget('clock');
      showToast('Clock widget shown');
    });

    elements.themeControl.addEventListener('click', (event) => {
      const button = event.target.closest('[data-theme-value]');
      if (button) patchSettings({ theme: button.dataset.themeValue });
    });
    document.getElementById('grid-view-control').addEventListener('click', (event) => {
      const button = event.target.closest('[data-grid-view]');
      if (button) patchSettings({ gridView: button.dataset.gridView });
    });
    elements.colorPresets.addEventListener('click', (event) => {
      const button = event.target.closest('[data-color]');
      if (button) patchSettings({ accent: button.dataset.color.toLowerCase() });
    });
    elements.customColor.addEventListener('change', () => {
      patchSettings({ accent: elements.customColor.value.toLowerCase() });
    });

    [elements.deadlineYear, elements.deadlineMonth, elements.deadlineDay].forEach((input) => {
      input.addEventListener('input', updateDeadlinePreview);
      input.addEventListener('change', updateDeadlinePreview);
    });
    elements.saveDeadline.addEventListener('click', saveDeadline);
    elements.clearDeadline.addEventListener('click', async () => {
      await patchSettings({ deadlineIso: '', deadlineTitle: '' }, 'Deadline cleared');
      syncDeadlineForm();
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state?.settings.theme === 'system') applyTheme();
    });
    api.onState((nextState) => {
      state = nextState;
      updateControlState();
    });
  }

  async function initialize() {
    if (!api) throw new Error('Zemen desktop bridge is unavailable');
    state = await api.getState();
    await migrateLegacyIfNeeded();
    bindEvents();
    updateControlState();
    syncDeadlineForm();
    try {
      elements.appVersion.textContent = `Zemen Grid ${await api.getVersion()}`;
    } catch {
      elements.appVersion.textContent = 'Zemen Grid';
    }
  }

  initialize().catch((error) => {
    console.error(error);
    document.querySelector('.hero-copy').textContent = 'The widget controls could not be loaded.';
  });
})();
