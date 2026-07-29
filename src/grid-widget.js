(function startGridWidget() {
  'use strict';

  const Calendar = window.ZemenCalendar;
  const api = window.zemen;
  const elements = Object.fromEntries(
    [
      'day-grid',
      'day-tooltip',
      'fitted-grid',
      'grid-viewport',
      'header-days-left',
      'hover-days-left',
      'hover-progress',
      'hover-summary',
      'month-labels',
      'next-range',
      'open-controls',
      'previous-range',
      'range-title',
      'tooltip-date',
      'tooltip-gregorian',
      'tooltip-note',
      'weekday-labels',
      'widget-header',
      'widget-legend',
      'widget-shell'
    ].map((id) => [
      id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()),
      document.getElementById(id)
    ])
  );

  let state = null;
  let focusDate = Calendar.today();
  let currentRange = null;
  let lastView = '';
  let lastTodayIso = '';
  let resizeObserver = null;

  function resolvedTheme() {
    if (state.settings.theme !== 'system') return state.settings.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyAppearance() {
    document.body.dataset.theme = resolvedTheme();
    document.documentElement.style.setProperty('--accent', state.settings.accent);
    elements.widgetHeader.classList.toggle('hidden', !state.settings.gridShowHeader);
    elements.widgetLegend.classList.toggle('hidden', !state.settings.gridShowLegend);
    elements.monthLabels.classList.toggle('hidden', !state.settings.gridShowMonths);
    elements.weekdayLabels.classList.toggle('hidden', !state.settings.gridShowWeekdays);
    elements.widgetShell.classList.toggle('show-hover-details', state.settings.gridHoverDetails);
  }

  function eraLabel() {
    return state.settings.language === 'en' ? 'E.C.' : 'ዓ.ም.';
  }

  function makeRange() {
    const parts = Calendar.getEthiopianParts(focusDate);
    const view = state.settings.gridView;
    let start;
    let end;
    let title;

    if (view === 'year') {
      start = Calendar.findYearStart(parts.year);
      end = Calendar.addDays(start, Calendar.getYearLength(parts.year) - 1);
      title = `${parts.year} ${eraLabel()}`;
    } else if (view === 'month') {
      start = Calendar.ethiopianToGregorian(parts.year, parts.month, 1);
      end = Calendar.addDays(start, Calendar.getMonthLength(parts.year, parts.month) - 1);
      title = `${Calendar.getMonthNames(state.settings.language)[parts.month - 1]} · ${parts.year} ${eraLabel()}`;
    } else {
      start = Calendar.startOfWeek(focusDate);
      end = Calendar.addDays(start, 6);
      const startParts = Calendar.getEthiopianParts(start);
      const endParts = Calendar.getEthiopianParts(end);
      const months = Calendar.getMonthNames(state.settings.language);
      if (startParts.year === endParts.year && startParts.month === endParts.month) {
        title = `${months[startParts.month - 1]} ${startParts.day}–${endParts.day} · ${startParts.year} ${eraLabel()}`;
      } else if (startParts.year === endParts.year) {
        title = `${months[startParts.month - 1]} ${startParts.day} – ${months[endParts.month - 1]} ${endParts.day} · ${startParts.year} ${eraLabel()}`;
      } else {
        title = `${Calendar.formatEthiopianShort(start, state.settings.language)} – ${Calendar.formatEthiopianShort(end, state.settings.language)}`;
      }
    }

    const gridStart = Calendar.startOfWeek(start);
    const gridEnd = Calendar.addDays(end, 6 - Calendar.mondayIndex(end));
    const weeks = Math.max(1, Math.round((Calendar.diffDays(gridStart, gridEnd) + 1) / 7));
    return { start, end, gridStart, gridEnd, weeks, title };
  }

  function render() {
    if (!state) return;
    if (lastView && lastView !== state.settings.gridView) focusDate = Calendar.today();
    lastView = state.settings.gridView;
    applyAppearance();
    currentRange = makeRange();
    elements.rangeTitle.textContent = currentRange.title;
    renderProgress();
    renderWeekdays();
    renderMonths();
    renderCells();
    lastTodayIso = Calendar.toISODate(new Date());
    requestAnimationFrame(fitGrid);
  }

  function refreshTimeSensitiveState() {
    renderProgress();
    const todayIso = Calendar.toISODate(new Date());
    if (todayIso !== lastTodayIso) render();
  }

  function renderProgress() {
    const progress = Calendar.getYearProgress(new Date());
    const daysText = `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left`;
    elements.headerDaysLeft.textContent = daysText;
    elements.hoverDaysLeft.textContent = `${daysText} in ${progress.ethiopianYear} ${eraLabel()}`;
    elements.hoverProgress.textContent = `Day ${progress.dayNumber} of ${progress.totalDays} · ${progress.percent.toFixed(1)}% elapsed`;
  }

  function renderWeekdays() {
    const names = Calendar.getWeekdayNames(state.settings.language);
    const mondayFirst = [names[1], names[2], names[3], names[4], names[5], names[6], names[0]];
    const fragment = document.createDocumentFragment();
    mondayFirst.forEach((name, index) => {
      const label = document.createElement('span');
      label.className = 'weekday-label';
      label.textContent = [0, 2, 4].includes(index) ? name.slice(0, 3) : '';
      fragment.append(label);
    });
    elements.weekdayLabels.replaceChildren(fragment);
  }

  function renderMonths() {
    const names = Calendar.getMonthNames(state.settings.language);
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
      label.textContent = names[item.month - 1];
      fragment.append(label);
    });
    elements.monthLabels.replaceChildren(fragment);
  }

  function renderCells() {
    const fragment = document.createDocumentFragment();
    const today = Calendar.today();
    const todayIso = Calendar.toISODate(today);
    const deadlineIso = state.settings.deadlineIso;
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
        button.disabled = true;
        button.tabIndex = -1;
      } else {
        const iso = Calendar.toISODate(cursor);
        const note = state.notes[iso];
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
        if (level > 0) button.classList.add(`level-${level}`);
        if (isToday) {
          button.classList.add('today');
          button.setAttribute('aria-current', 'date');
        }
        if (note && (String(note.text || '').trim() || savedLevel > 0)) button.classList.add('has-note');
        if (deadlineIso && iso === deadlineIso) button.classList.add('deadline');
        button.setAttribute(
          'aria-label',
          [
            Calendar.formatEthiopianShort(cursor, state.settings.language),
            Calendar.formatGregorian(cursor),
            isToday ? 'today' : '',
            deadlineIso === iso ? 'deadline' : '',
            note?.text ? `note: ${String(note.text).slice(0, 100)}` : ''
          ]
            .filter(Boolean)
            .join(', ')
        );
      }
      fragment.append(button);
      cursor = Calendar.addDays(cursor, 1);
      slot += 1;
    }

    elements.dayGrid.style.setProperty('--weeks', String(currentRange.weeks));
    elements.dayGrid.setAttribute('aria-colcount', String(currentRange.weeks));
    elements.dayGrid.setAttribute('aria-rowcount', '7');
    elements.dayGrid.replaceChildren(fragment);
  }

  function fitGrid() {
    if (!currentRange || !state) return;
    const shellStyle = window.getComputedStyle(elements.widgetShell);
    const pixel = (value, fallback) => {
      const parsed = Number.parseFloat(value || '');
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const horizontalPadding =
      pixel(shellStyle.paddingLeft, 14) +
      pixel(shellStyle.paddingRight, 14);
    const verticalPadding =
      pixel(shellStyle.paddingTop, 14) +
      pixel(shellStyle.paddingBottom, 14);
    const borderHeight =
      pixel(shellStyle.borderTopWidth, 1) +
      pixel(shellStyle.borderBottomWidth, 1);
    const viewportWidth =
      elements.gridViewport.clientWidth ||
      Math.max(580, (elements.widgetShell.clientWidth || 1040) - horizontalPadding);
    const gap = viewportWidth < 760 ? 2 : viewportWidth < 1200 ? 3 : 4;
    let labelWidth = state.settings.gridShowWeekdays ? 42 : 0;

    function cellFor(label) {
      return Math.max(
        5,
        (viewportWidth - label - gap * (currentRange.weeks - 1)) / currentRange.weeks
      );
    }

    let cell = cellFor(labelWidth);
    if (state.settings.gridShowWeekdays) {
      labelWidth = Math.max(34, Math.min(58, cell * 3.1));
    }
    cell = cellFor(labelWidth);
    const monthHeight = state.settings.gridShowMonths
      ? Math.max(15, Math.min(27, cell * 1.28))
      : 0;

    const gridWidth = cell * currentRange.weeks + gap * (currentRange.weeks - 1);
    const gridHeight = cell * 7 + gap * 6;
    const totalWidth = labelWidth + gridWidth;
    const totalHeight = monthHeight + gridHeight;
    const style = elements.fittedGrid.style;
    style.setProperty('--weeks', String(currentRange.weeks));
    style.setProperty('--cell', `${cell}px`);
    style.setProperty('--gap', `${gap}px`);
    style.setProperty('--label-width', `${labelWidth}px`);
    style.setProperty('--month-height', `${monthHeight}px`);
    style.setProperty('--grid-width', `${gridWidth}px`);
    style.setProperty('--grid-height', `${gridHeight}px`);
    style.width = `${totalWidth}px`;
    style.height = `${totalHeight}px`;
    elements.gridViewport.style.height = `${totalHeight}px`;

    const headerHeight = state.settings.gridShowHeader
      ? Math.max(30, elements.widgetHeader.offsetHeight || 0) + 5
      : 0;
    const legendHeight = state.settings.gridShowLegend
      ? Math.max(26, elements.widgetLegend.offsetHeight || 0)
      : 0;
    const preferredHeight = Math.ceil(
      verticalPadding + borderHeight + headerHeight + totalHeight + legendHeight
    );
    api.fitWidget?.('grid', preferredHeight);
  }

  function moveRange(direction) {
    const parts = Calendar.getEthiopianParts(focusDate);
    if (state.settings.gridView === 'week') {
      focusDate = Calendar.addDays(focusDate, direction * 7);
    } else if (state.settings.gridView === 'month') {
      let year = parts.year;
      let month = parts.month + direction;
      if (month < 1) {
        month = 13;
        year -= 1;
      } else if (month > 13) {
        month = 1;
        year += 1;
      }
      focusDate = Calendar.ethiopianToGregorian(
        year,
        month,
        Math.min(parts.day, Calendar.getMonthLength(year, month))
      );
    } else {
      const year = parts.year + direction;
      focusDate = Calendar.ethiopianToGregorian(
        year,
        parts.month,
        Math.min(parts.day, Calendar.getMonthLength(year, parts.month))
      );
    }
    render();
  }

  function showTooltip(cell) {
    if (!cell?.dataset.date) return;
    const date = Calendar.fromISODate(cell.dataset.date);
    const note = state.notes[cell.dataset.date];
    elements.tooltipDate.textContent = Calendar.formatEthiopianShort(date, state.settings.language);
    elements.tooltipGregorian.textContent = Calendar.formatGregorian(date);
    elements.tooltipNote.textContent = String(note?.text || '').trim();
    elements.tooltipNote.classList.toggle('hidden', !elements.tooltipNote.textContent);
    elements.dayTooltip.classList.remove('hidden');

    const rect = cell.getBoundingClientRect();
    const tooltipRect = elements.dayTooltip.getBoundingClientRect();
    const left = Math.max(
      7,
      Math.min(window.innerWidth - tooltipRect.width - 7, rect.left + rect.width / 2 - tooltipRect.width / 2)
    );
    const preferredTop = rect.top - tooltipRect.height - 6;
    const top = preferredTop >= 5 ? preferredTop : rect.bottom + 6;
    elements.dayTooltip.style.left = `${left}px`;
    elements.dayTooltip.style.top = `${Math.min(window.innerHeight - tooltipRect.height - 5, top)}px`;
  }

  function bindEvents() {
    elements.openControls.addEventListener('click', () => api.showController());
    elements.previousRange.addEventListener('click', () => moveRange(-1));
    elements.nextRange.addEventListener('click', () => moveRange(1));
    elements.dayGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) api.openNote(cell.dataset.date);
    });
    elements.dayGrid.addEventListener('mouseover', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) showTooltip(cell);
    });
    elements.dayGrid.addEventListener('mouseout', (event) => {
      if (event.target.closest('.day-cell[data-date]')) elements.dayTooltip.classList.add('hidden');
    });
    elements.dayGrid.addEventListener('focusin', (event) => {
      const cell = event.target.closest('.day-cell[data-date]');
      if (cell) showTooltip(cell);
    });
    elements.dayGrid.addEventListener('focusout', () => elements.dayTooltip.classList.add('hidden'));
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state?.settings.theme === 'system') applyAppearance();
    });
    api.onState((nextState) => {
      state = nextState;
      render();
    });
    resizeObserver = new ResizeObserver(fitGrid);
    resizeObserver.observe(elements.gridViewport);
    window.addEventListener('resize', fitGrid);
  }

  async function initialize() {
    state = await api.getState();
    bindEvents();
    render();
    window.setInterval(refreshTimeSensitiveState, 30_000);
  }

  initialize().catch((error) => {
    console.error(error);
    elements.hoverDaysLeft.textContent = 'Calendar unavailable';
  });
})();
