(function startZemenGrid() {
  'use strict';

  const Calendar = window.ZemenCalendar;
  const desktop = window.zemenDesktop || {};
  const SETTINGS_KEY = 'zemen-grid:settings:v1';
  const NOTES_KEY = 'zemen-grid:notes:v1';

  const defaultSettings = Object.freeze({
    alwaysOnTop: true,
    clock24: true,
    compact: false,
    language: 'am',
    showMonths: true,
    showWeekdays: true,
    accent: '#39d353',
    surface: 'dark',
    viewMode: 'year',
    deadlineIso: '',
    deadlineTitle: ''
  });

  const elements = Object.fromEntries(
    [
      'always-on-top-setting',
      'app-version',
      'cancel-note',
      'clear-deadline',
      'clock-format-setting',
      'close-button',
      'compact-setting',
      'custom-color',
      'day-grid',
      'day-tooltip',
      'deadline-chip',
      'deadline-day',
      'deadline-month',
      'deadline-preview',
      'deadline-summary',
      'deadline-title',
      'deadline-year',
      'delete-note',
      'ethiopian-date',
      'exact-countdown',
      'heatmap-scroll',
      'language-setting',
      'live-clock',
      'maximize-button',
      'minimize-button',
      'month-labels',
      'month-labels-setting',
      'next-range',
      'note-close',
      'note-date-title',
      'note-dialog',
      'note-gregorian-date',
      'note-text',
      'palette-grid',
      'pin-button',
      'pin-state',
      'previous-range',
      'progress-fill',
      'progress-label',
      'progress-percent',
      'progress-track',
      'range-title',
      'save-deadline',
      'save-note',
      'settings-backdrop',
      'settings-button',
      'settings-close',
      'settings-panel',
      'surface-setting',
      'today-button',
      'toast',
      'tooltip-date',
      'tooltip-gregorian',
      'tooltip-note',
      'weekday-labels',
      'weekday-labels-setting',
      'year-position',
      'days-left'
    ].map((id) => [
      id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()),
      document.getElementById(id)
    ])
  );

  let settings = loadObject(SETTINGS_KEY, defaultSettings);
  let notes = loadObject(NOTES_KEY, {});
  let focusDate = Calendar.today();
  let activeNoteIso = '';
  let currentRange = null;
  let lastRenderedToday = '';
  let toastTimer = null;
  let progressTimer = 0;

  settings = sanitizeSettings(settings);
  notes = notes && typeof notes === 'object' && !Array.isArray(notes) ? notes : {};

  function loadObject(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...fallback };
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : { ...fallback };
    } catch {
      return { ...fallback };
    }
  }

  function saveObject(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast('Could not save on this device');
      return false;
    }
  }

  function sanitizeSettings(value) {
    const clean = { ...defaultSettings, ...(value || {}) };
    clean.alwaysOnTop = Boolean(clean.alwaysOnTop);
    clean.clock24 = Boolean(clean.clock24);
    clean.compact = Boolean(clean.compact);
    clean.language = clean.language === 'en' ? 'en' : 'am';
    clean.showMonths = Boolean(clean.showMonths);
    clean.showWeekdays = Boolean(clean.showWeekdays);
    clean.accent = /^#[0-9a-f]{6}$/i.test(clean.accent) ? clean.accent.toLowerCase() : defaultSettings.accent;
    clean.surface = ['dark', 'light', 'system'].includes(clean.surface) ? clean.surface : 'dark';
    clean.viewMode = ['year', 'month', 'week'].includes(clean.viewMode) ? clean.viewMode : 'year';
    clean.deadlineIso = /^\d{4}-\d{2}-\d{2}$/.test(clean.deadlineIso) ? clean.deadlineIso : '';
    clean.deadlineTitle = String(clean.deadlineTitle || '').slice(0, 60);
    return clean;
  }

  function saveSettings() {
    saveObject(SETTINGS_KEY, settings);
  }

  function eraLabel() {
    return settings.language === 'am' ? 'ዓ.ም.' : 'E.C.';
  }

  function resolveSurface() {
    if (settings.surface !== 'system') return settings.surface;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyAppearance() {
    document.documentElement.style.setProperty('--accent', settings.accent);
    document.body.dataset.surface = resolveSurface();
    document.body.classList.toggle('compact', settings.compact);
    elements.customColor.value = settings.accent;
    document.querySelectorAll('.palette-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.color.toLowerCase() === settings.accent);
    });
  }

  function syncSettingsControls() {
    elements.alwaysOnTopSetting.checked = settings.alwaysOnTop;
    elements.clockFormatSetting.checked = settings.clock24;
    elements.compactSetting.checked = settings.compact;
    elements.languageSetting.value = settings.language;
    elements.monthLabelsSetting.checked = settings.showMonths;
    elements.weekdayLabelsSetting.checked = settings.showWeekdays;
    elements.surfaceSetting.value = settings.surface;
    elements.customColor.value = settings.accent;
    document.querySelectorAll('.view-button').forEach((button) => {
      button.classList.toggle('active', button.dataset.view === settings.viewMode);
    });
    applyAppearance();
  }

  function setSetting(key, value, { render = false, live = false } = {}) {
    settings[key] = value;
    saveSettings();
    syncSettingsControls();
    if (render) renderCalendar();
    if (live) renderLive();
  }

  function makeRange() {
    const focusParts = Calendar.getEthiopianParts(focusDate);
    let start;
    let end;
    let title;

    if (settings.viewMode === 'year') {
      start = Calendar.findYearStart(focusParts.year);
      end = Calendar.addDays(start, Calendar.getYearLength(focusParts.year) - 1);
      title = `${focusParts.year} ${eraLabel()}`;
    } else if (settings.viewMode === 'month') {
      start = Calendar.ethiopianToGregorian(focusParts.year, focusParts.month, 1);
      end = Calendar.addDays(start, Calendar.getMonthLength(focusParts.year, focusParts.month) - 1);
      title = `${Calendar.getMonthNames(settings.language)[focusParts.month - 1]} · ${focusParts.year} ${eraLabel()}`;
    } else {
      start = Calendar.startOfWeek(focusDate);
      end = Calendar.addDays(start, 6);
      const startParts = Calendar.getEthiopianParts(start);
      const endParts = Calendar.getEthiopianParts(end);
      const months = Calendar.getMonthNames(settings.language);
      if (startParts.year === endParts.year && startParts.month === endParts.month) {
        title = `${months[startParts.month - 1]} ${startParts.day}–${endParts.day} · ${startParts.year} ${eraLabel()}`;
      } else if (startParts.year === endParts.year) {
        title = `${months[startParts.month - 1]} ${startParts.day} – ${months[endParts.month - 1]} ${endParts.day} · ${startParts.year} ${eraLabel()}`;
      } else {
        title = `${Calendar.formatEthiopianShort(start, settings.language)} – ${Calendar.formatEthiopianShort(end, settings.language)}`;
      }
    }

    const gridStart = Calendar.startOfWeek(start);
    const gridEnd = Calendar.addDays(end, 6 - Calendar.mondayIndex(end));
    const weeks = Math.max(1, Math.round((Calendar.diffDays(gridStart, gridEnd) + 1) / 7));
    return { start, end, gridStart, gridEnd, weeks, title };
  }

  function renderCalendar() {
    currentRange = makeRange();
    elements.rangeTitle.textContent = currentRange.title;
    elements.heatmapScroll.style.setProperty('--weeks', String(currentRange.weeks));
    elements.heatmapScroll.style.setProperty(
      '--cell-max',
      settings.viewMode === 'week' ? '54px' : settings.viewMode === 'month' ? '30px' : '18px'
    );
    elements.dayGrid.setAttribute('aria-rowcount', '7');
    elements.dayGrid.setAttribute('aria-colcount', String(currentRange.weeks));

    renderWeekdayLabels();
    renderMonthLabels();
    renderDayCells();

    const today = Calendar.today();
    const containsToday =
      Calendar.compareDays(today, currentRange.start) >= 0 &&
      Calendar.compareDays(today, currentRange.end) <= 0;
    elements.todayButton.classList.toggle('hidden', containsToday);
    elements.monthLabels.classList.toggle(
      'hidden',
      !settings.showMonths || settings.viewMode === 'week'
    );
    elements.weekdayLabels.classList.toggle('hidden', !settings.showWeekdays);
    elements.heatmapScroll.classList.toggle('hide-weekdays', !settings.showWeekdays);
  }

  function renderWeekdayLabels() {
    const names = Calendar.getWeekdayNames(settings.language);
    const mondayFirst = [names[1], names[2], names[3], names[4], names[5], names[6], names[0]];
    const fragment = document.createDocumentFragment();
    mondayFirst.forEach((name, index) => {
      const label = document.createElement('span');
      label.className = 'weekday-label';
      const sparseYearLabel = settings.viewMode === 'year' && ![0, 2, 4].includes(index);
      label.textContent = sparseYearLabel ? '' : settings.viewMode === 'year' ? name.slice(0, 3) : name;
      fragment.append(label);
    });
    elements.weekdayLabels.replaceChildren(fragment);
  }

  function renderMonthLabels() {
    const monthNames = Calendar.getMonthNames(settings.language);
    const beginnings = [];
    let cursor = currentRange.start;
    while (Calendar.compareDays(cursor, currentRange.end) <= 0) {
      const parts = Calendar.getEthiopianParts(cursor);
      if (Calendar.compareDays(cursor, currentRange.start) === 0 || parts.day === 1) {
        beginnings.push({ date: cursor, month: parts.month });
      }
      cursor = Calendar.addDays(cursor, 1);
    }

    const fragment = document.createDocumentFragment();
    beginnings.forEach((item, index) => {
      const column = Math.floor(Calendar.diffDays(currentRange.gridStart, item.date) / 7) + 1;
      const nextColumn =
        index + 1 < beginnings.length
          ? Math.floor(Calendar.diffDays(currentRange.gridStart, beginnings[index + 1].date) / 7) + 1
          : currentRange.weeks + 1;
      const label = document.createElement('span');
      label.className = 'month-label';
      label.style.gridColumn = `${column} / span ${Math.max(1, nextColumn - column)}`;
      label.textContent = monthNames[item.month - 1];
      fragment.append(label);
    });
    elements.monthLabels.replaceChildren(fragment);
  }

  function renderDayCells() {
    const fragment = document.createDocumentFragment();
    const today = Calendar.today();
    const todayIso = Calendar.toISODate(today);
    const deadlineIso = settings.deadlineIso;
    let cursor = currentRange.gridStart;
    let slot = 0;

    while (Calendar.compareDays(cursor, currentRange.gridEnd) <= 0) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'day-cell';
      button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-rowindex', String((slot % 7) + 1));
      button.setAttribute('aria-colindex', String(Math.floor(slot / 7) + 1));

      const inRange =
        Calendar.compareDays(cursor, currentRange.start) >= 0 &&
        Calendar.compareDays(cursor, currentRange.end) <= 0;

      if (!inRange) {
        button.classList.add('outside');
        button.tabIndex = -1;
        button.disabled = true;
      } else {
        const iso = Calendar.toISODate(cursor);
        const note = notes[iso];
        const isToday = iso === todayIso;
        const isPast = Calendar.compareDays(cursor, today) < 0;
        const savedLevel = Number(note?.level);
        const level =
          Number.isInteger(savedLevel) && savedLevel >= 1 && savedLevel <= 4
            ? savedLevel
            : isToday
              ? 4
              : isPast
                ? 2
                : 0;

        button.dataset.date = iso;
        button.classList.toggle('future', !isPast && !isToday && level === 0);
        if (level > 0) button.classList.add(`level-${level}`);
        if (isToday) {
          button.classList.add('today');
          button.setAttribute('aria-current', 'date');
        }
        if (note && (String(note.text || '').trim() || savedLevel > 0)) button.classList.add('has-note');
        if (deadlineIso && iso === deadlineIso) button.classList.add('deadline');

        const description = [
          Calendar.formatEthiopianShort(cursor, settings.language),
          Calendar.formatGregorian(cursor),
          isToday ? 'today' : '',
          deadlineIso === iso ? 'deadline' : '',
          note?.text ? `note: ${String(note.text).slice(0, 120)}` : ''
        ]
          .filter(Boolean)
          .join(', ');
        button.setAttribute('aria-label', description);
      }

      fragment.append(button);
      cursor = Calendar.addDays(cursor, 1);
      slot += 1;
    }

    elements.dayGrid.replaceChildren(fragment);
  }

  function moveRange(direction) {
    const parts = Calendar.getEthiopianParts(focusDate);
    if (settings.viewMode === 'week') {
      focusDate = Calendar.addDays(focusDate, direction * 7);
    } else if (settings.viewMode === 'month') {
      let year = parts.year;
      let month = parts.month + direction;
      if (month < 1) {
        month = 13;
        year -= 1;
      } else if (month > 13) {
        month = 1;
        year += 1;
      }
      const day = Math.min(parts.day, Calendar.getMonthLength(year, month));
      focusDate = Calendar.ethiopianToGregorian(year, month, day);
    } else {
      const year = parts.year + direction;
      const day = Math.min(parts.day, Calendar.getMonthLength(year, parts.month));
      focusDate = Calendar.ethiopianToGregorian(year, parts.month, day);
    }
    renderCalendar();
  }

  function showTooltip(cell) {
    if (!cell?.dataset.date) return;
    const date = Calendar.fromISODate(cell.dataset.date);
    const note = notes[cell.dataset.date];
    elements.tooltipDate.textContent = Calendar.formatEthiopianShort(date, settings.language);
    elements.tooltipGregorian.textContent = Calendar.formatGregorian(date);
    elements.tooltipNote.textContent = String(note?.text || '').trim();
    elements.tooltipNote.classList.toggle('hidden', !elements.tooltipNote.textContent);
    elements.dayTooltip.classList.remove('hidden');

    const cellRect = cell.getBoundingClientRect();
    const tooltipRect = elements.dayTooltip.getBoundingClientRect();
    const left = Math.min(
      window.innerWidth - tooltipRect.width - 10,
      Math.max(10, cellRect.left + cellRect.width / 2 - tooltipRect.width / 2)
    );
    const preferredTop = cellRect.top - tooltipRect.height - 9;
    const top = preferredTop >= 8 ? preferredTop : cellRect.bottom + 9;
    elements.dayTooltip.style.left = `${left}px`;
    elements.dayTooltip.style.top = `${top}px`;
  }

  function hideTooltip() {
    elements.dayTooltip.classList.add('hidden');
  }

  function openNote(iso) {
    activeNoteIso = iso;
    const date = Calendar.fromISODate(iso);
    const note = notes[iso] || {};
    const level = Number.isInteger(Number(note.level)) ? Number(note.level) : 0;
    elements.noteDateTitle.textContent = Calendar.formatEthiopianShort(date, settings.language);
    elements.noteGregorianDate.textContent = Calendar.formatGregorian(date);
    elements.noteText.value = String(note.text || '');
    const levelInput = document.querySelector(`input[name="note-level"][value="${level}"]`);
    if (levelInput) levelInput.checked = true;
    elements.deleteNote.classList.toggle('hidden', !notes[iso]);
    hideTooltip();
    elements.noteDialog.showModal();
    requestAnimationFrame(() => elements.noteText.focus());
  }

  function closeNote() {
    if (elements.noteDialog.open) elements.noteDialog.close();
    activeNoteIso = '';
  }

  function saveNote() {
    if (!activeNoteIso) return;
    const text = elements.noteText.value.trim();
    const selected = document.querySelector('input[name="note-level"]:checked');
    const level = Number(selected?.value || 0);
    if (!text && level === 0) {
      delete notes[activeNoteIso];
    } else {
      notes[activeNoteIso] = {
        text,
        level,
        updatedAt: new Date().toISOString()
      };
    }
    saveObject(NOTES_KEY, notes);
    closeNote();
    renderCalendar();
    showToast('Day saved locally');
  }

  function deleteNote() {
    if (!activeNoteIso) return;
    delete notes[activeNoteIso];
    saveObject(NOTES_KEY, notes);
    closeNote();
    renderCalendar();
    showToast('Day note removed');
  }

  function openSettings({ deadline = false } = {}) {
    syncDeadlineDraft();
    elements.settingsBackdrop.classList.remove('hidden');
    elements.settingsPanel.classList.add('open');
    elements.settingsPanel.setAttribute('aria-hidden', 'false');
    if (deadline) {
      requestAnimationFrame(() => {
        document.querySelector('.deadline-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        elements.deadlineTitle.focus();
      });
    }
  }

  function closeSettings() {
    elements.settingsPanel.classList.remove('open');
    elements.settingsPanel.setAttribute('aria-hidden', 'true');
    elements.settingsBackdrop.classList.add('hidden');
    elements.settingsButton.focus();
  }

  function populateDeadlineMonths() {
    const selected = Number(elements.deadlineMonth.value) || 1;
    const fragment = document.createDocumentFragment();
    Calendar.getMonthNames(settings.language).forEach((name, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = `${index + 1} · ${name}`;
      fragment.append(option);
    });
    elements.deadlineMonth.replaceChildren(fragment);
    elements.deadlineMonth.value = String(Math.min(13, Math.max(1, selected)));
  }

  function syncDeadlineDraft() {
    let date;
    try {
      date = settings.deadlineIso ? Calendar.fromISODate(settings.deadlineIso) : Calendar.today();
    } catch {
      date = Calendar.today();
    }
    const parts = Calendar.getEthiopianParts(date);
    populateDeadlineMonths();
    elements.deadlineTitle.value = settings.deadlineTitle;
    elements.deadlineYear.value = String(parts.year);
    elements.deadlineMonth.value = String(parts.month);
    elements.deadlineDay.value = String(parts.day);
    elements.clearDeadline.classList.toggle('hidden', !settings.deadlineIso);
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
      elements.deadlinePreview.textContent = `${Calendar.formatEthiopianShort(date, settings.language)} · ${Calendar.formatGregorian(date)}`;
      elements.saveDeadline.disabled = false;
    } catch (error) {
      elements.deadlinePreview.textContent = error.message || 'Choose a valid Ethiopian date';
      elements.saveDeadline.disabled = true;
    }
  }

  function saveDeadline() {
    try {
      const date = getDeadlineDraft();
      settings.deadlineIso = Calendar.toISODate(date);
      settings.deadlineTitle = elements.deadlineTitle.value.trim().slice(0, 60);
      saveSettings();
      elements.clearDeadline.classList.remove('hidden');
      renderLive();
      renderCalendar();
      showToast('Deadline set');
    } catch (error) {
      elements.deadlinePreview.textContent = error.message || 'Choose a valid date';
    }
  }

  function clearDeadline() {
    settings.deadlineIso = '';
    settings.deadlineTitle = '';
    saveSettings();
    syncDeadlineDraft();
    renderLive();
    renderCalendar();
    showToast('Deadline cleared');
  }

  function formatCountdown(milliseconds) {
    const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function renderDeadlineSummary() {
    if (!settings.deadlineIso) {
      elements.deadlineChip.classList.add('hidden');
      return;
    }

    try {
      const deadline = Calendar.fromISODate(settings.deadlineIso);
      const difference = Calendar.diffDays(Calendar.today(), deadline);
      const title = settings.deadlineTitle || 'deadline';
      let summary;
      if (difference === 0) summary = `${title} is today`;
      else if (difference > 0) summary = `${difference} ${difference === 1 ? 'day' : 'days'} to ${title}`;
      else summary = `${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'day' : 'days'} since ${title}`;
      elements.deadlineSummary.textContent = summary;
      elements.deadlineChip.classList.remove('hidden');
    } catch {
      settings.deadlineIso = '';
      saveSettings();
      elements.deadlineChip.classList.add('hidden');
    }
  }

  function renderLive() {
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: !settings.clock24
    });
    const progress = Calendar.getYearProgress(now);
    const percentText = `${progress.percent.toFixed(1)}%`;
    const yearLabel = `${progress.ethiopianYear} ${eraLabel()}`;

    elements.liveClock.textContent = timeFormatter.format(now);
    elements.liveClock.dateTime = now.toISOString();
    elements.ethiopianDate.textContent = Calendar.formatEthiopian(now, settings.language);
    elements.daysLeft.textContent = `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left in ${yearLabel}`;
    elements.yearPosition.textContent = `Day ${progress.dayNumber} of ${progress.totalDays} · ${percentText} elapsed`;
    elements.exactCountdown.textContent = `${formatCountdown(progress.millisecondsLeft)} until ${progress.ethiopianYear + 1} ${eraLabel()}`;
    elements.progressLabel.textContent = `${yearLabel} progress`;
    elements.progressPercent.textContent = percentText;
    elements.progressFill.style.width = `${progress.percent}%`;
    elements.progressTrack.setAttribute('aria-valuenow', String(progress.percent.toFixed(1)));

    renderDeadlineSummary();

    const todayIso = Calendar.toISODate(now);
    if (todayIso !== lastRenderedToday) {
      lastRenderedToday = todayIso;
      renderCalendar();
    }

    if (Date.now() - progressTimer > 30_000 && typeof desktop.setProgress === 'function') {
      progressTimer = Date.now();
      desktop.setProgress(progress.percent / 100);
    }
  }

  function renderPinState(value = settings.alwaysOnTop) {
    settings.alwaysOnTop = Boolean(value);
    elements.pinButton.classList.toggle('active', settings.alwaysOnTop);
    elements.pinState.classList.toggle('hidden', !settings.alwaysOnTop);
    elements.pinButton.title = settings.alwaysOnTop ? 'Always on top is on' : 'Always on top is off';
    elements.alwaysOnTopSetting.checked = settings.alwaysOnTop;
  }

  async function setPinned(value) {
    let actual = Boolean(value);
    if (typeof desktop.setAlwaysOnTop === 'function') {
      try {
        actual = await desktop.setAlwaysOnTop(value);
      } catch {
        showToast('Always-on-top is unavailable in this preview');
      }
    }
    settings.alwaysOnTop = actual;
    saveSettings();
    renderPinState(actual);
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => elements.toast.classList.add('hidden'), 2200);
  }

  function bindEvents() {
    elements.pinButton.addEventListener('click', () => setPinned(!settings.alwaysOnTop));
    elements.settingsButton.addEventListener('click', () => openSettings());
    elements.settingsClose.addEventListener('click', closeSettings);
    elements.settingsBackdrop.addEventListener('click', closeSettings);
    elements.minimizeButton.addEventListener('click', () => desktop.minimize?.());
    elements.maximizeButton.addEventListener('click', () => desktop.toggleMaximize?.());
    elements.closeButton.addEventListener('click', () => desktop.close?.());

    elements.previousRange.addEventListener('click', () => moveRange(-1));
    elements.nextRange.addEventListener('click', () => moveRange(1));
    elements.todayButton.addEventListener('click', () => {
      focusDate = Calendar.today();
      renderCalendar();
    });

    document.querySelectorAll('.view-button').forEach((button) => {
      button.addEventListener('click', () => {
        setSetting('viewMode', button.dataset.view, { render: true });
      });
    });

    elements.dayGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) openNote(cell.dataset.date);
    });
    elements.dayGrid.addEventListener('mouseover', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) showTooltip(cell);
    });
    elements.dayGrid.addEventListener('mouseout', (event) => {
      if (event.target.closest('.day-cell[data-date]')) hideTooltip();
    });
    elements.dayGrid.addEventListener('focusin', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) showTooltip(cell);
    });
    elements.dayGrid.addEventListener('focusout', hideTooltip);

    elements.noteClose.addEventListener('click', closeNote);
    elements.cancelNote.addEventListener('click', closeNote);
    elements.saveNote.addEventListener('click', saveNote);
    elements.deleteNote.addEventListener('click', deleteNote);
    elements.noteText.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        saveNote();
      }
    });
    elements.noteDialog.addEventListener('click', (event) => {
      if (event.target === elements.noteDialog) closeNote();
    });

    elements.alwaysOnTopSetting.addEventListener('change', (event) => setPinned(event.target.checked));
    elements.compactSetting.addEventListener('change', (event) => {
      setSetting('compact', event.target.checked);
    });
    elements.clockFormatSetting.addEventListener('change', (event) => {
      setSetting('clock24', event.target.checked, { live: true });
    });
    elements.languageSetting.addEventListener('change', (event) => {
      settings.language = event.target.value === 'en' ? 'en' : 'am';
      saveSettings();
      populateDeadlineMonths();
      updateDeadlinePreview();
      renderCalendar();
      renderLive();
    });
    elements.monthLabelsSetting.addEventListener('change', (event) => {
      setSetting('showMonths', event.target.checked, { render: true });
    });
    elements.weekdayLabelsSetting.addEventListener('change', (event) => {
      setSetting('showWeekdays', event.target.checked, { render: true });
    });
    elements.surfaceSetting.addEventListener('change', (event) => {
      setSetting('surface', event.target.value);
    });
    elements.paletteGrid.addEventListener('click', (event) => {
      const button = event.target.closest('.palette-button[data-color]');
      if (!button) return;
      setSetting('accent', button.dataset.color.toLowerCase());
    });
    elements.customColor.addEventListener('input', (event) => {
      settings.accent = event.target.value.toLowerCase();
      applyAppearance();
    });
    elements.customColor.addEventListener('change', () => saveSettings());

    [elements.deadlineYear, elements.deadlineMonth, elements.deadlineDay].forEach((input) => {
      input.addEventListener('input', updateDeadlinePreview);
      input.addEventListener('change', updateDeadlinePreview);
    });
    elements.saveDeadline.addEventListener('click', saveDeadline);
    elements.clearDeadline.addEventListener('click', clearDeadline);
    elements.deadlineChip.addEventListener('click', () => openSettings({ deadline: true }));

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (settings.surface === 'system') applyAppearance();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && elements.settingsPanel.classList.contains('open')) {
        closeSettings();
      } else if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault();
        openSettings();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
        event.preventDefault();
        focusDate = Calendar.today();
        renderCalendar();
      }
    });
  }

  async function initializeDesktop() {
    renderPinState(settings.alwaysOnTop);
    await setPinned(settings.alwaysOnTop);
    if (typeof desktop.getVersion === 'function') {
      try {
        const version = await desktop.getVersion();
        elements.appVersion.textContent = `Zemen Grid ${version}`;
      } catch {
        elements.appVersion.textContent = 'Zemen Grid';
      }
    }
  }

  function initialize() {
    bindEvents();
    syncSettingsControls();
    syncDeadlineDraft();
    renderCalendar();
    renderLive();
    initializeDesktop();
    window.setInterval(renderLive, 1000);
  }

  try {
    initialize();
  } catch (error) {
    console.error(error);
    elements.ethiopianDate.textContent = 'The Ethiopian calendar could not be loaded.';
    elements.daysLeft.textContent = error.message || 'Calendar error';
  }
})();
