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
  let resizeFrame = 0;

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

  function viewportWidth() {
    const shellStyle = window.getComputedStyle(elements.widgetShell);
    const left = Number.parseFloat(shellStyle.paddingLeft || '') || 14;
    const right = Number.parseFloat(shellStyle.paddingRight || '') || 14;
    return (
      elements.gridViewport.clientWidth ||
      Math.max(280, (elements.widgetShell.clientWidth || window.innerWidth || 1180) - left - right)
    );
  }

  function adaptiveMonthSpan(width = viewportWidth()) {
    if (width < 430) return 1;
    if (width < 740) return 3;
    if (width < 1040) return 6;
    return 13;
  }

  function adaptiveYearRange(parts) {
    const monthSpan = adaptiveMonthSpan();
    if (monthSpan === 13) {
      const start = Calendar.findYearStart(parts.year);
      return {
        start,
        end: Calendar.addDays(start, Calendar.getYearLength(parts.year) - 1),
        monthSpan,
        title: `${parts.year} ${eraLabel()}`
      };
    }

    const firstPossible = Math.max(1, Math.min(14 - monthSpan, parts.month - Math.floor((monthSpan - 1) / 2)));
    const lastMonth = firstPossible + monthSpan - 1;
    const names = Calendar.getMonthNames(state.settings.language);
    const start = Calendar.ethiopianToGregorian(parts.year, firstPossible, 1);
    const end = Calendar.ethiopianToGregorian(
      parts.year,
      lastMonth,
      Calendar.getMonthLength(parts.year, lastMonth)
    );
    const title =
      monthSpan === 1
        ? `${names[firstPossible - 1]} · ${parts.year} ${eraLabel()}`
        : `${names[firstPossible - 1]}–${names[lastMonth - 1]} · ${parts.year} ${eraLabel()}`;

    return { start, end, monthSpan, title };
  }

  function makeRange() {
    const parts = Calendar.getEthiopianParts(focusDate);
    const view = state.settings.gridView;
    let start;
    let end;
    let title;
    let monthSpan = 1;

    if (view === 'year') {
      ({ start, end, title, monthSpan } = adaptiveYearRange(parts));
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
    const layout = view === 'year' ? 'timeline' : 'calendar';
    const columns = layout === 'timeline' ? weeks : 7;
    const rows = layout === 'timeline' ? 7 : weeks;
    return { start, end, gridStart, gridEnd, weeks, columns, rows, layout, monthSpan, title };
  }

  function render() {
    if (!state) return;
    if (lastView && lastView !== state.settings.gridView) focusDate = Calendar.today();
    lastView = state.settings.gridView;
    applyAppearance();
    currentRange = makeRange();
    elements.fittedGrid.classList.toggle('timeline-layout', currentRange.layout === 'timeline');
    elements.fittedGrid.classList.toggle('calendar-layout', currentRange.layout === 'calendar');
    elements.widgetShell.dataset.view = state.settings.gridView;
    elements.widgetShell.dataset.monthSpan = String(currentRange.monthSpan);
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

  function shortWeekday(name) {
    return state.settings.language === 'en' ? name.slice(0, 3) : name.slice(0, 2);
  }

  function renderWeekdays() {
    const names = Calendar.getWeekdayNames(state.settings.language);
    const mondayFirst = [names[1], names[2], names[3], names[4], names[5], names[6], names[0]];
    const fragment = document.createDocumentFragment();
    mondayFirst.forEach((name, index) => {
      const label = document.createElement('span');
      label.className = 'weekday-label';
      label.textContent =
        currentRange.layout === 'calendar' || [0, 2, 4].includes(index) ? shortWeekday(name) : '';
      label.title = name;
      fragment.append(label);
    });
    elements.weekdayLabels.replaceChildren(fragment);
  }

  function renderMonths() {
    const fragment = document.createDocumentFragment();
    if (currentRange.layout === 'calendar') {
      const label = document.createElement('span');
      label.className = 'month-label calendar-caption';
      label.style.gridColumn = '1 / -1';
      label.textContent = currentRange.title;
      fragment.append(label);
      elements.monthLabels.replaceChildren(fragment);
      return;
    }

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
      const rowIndex =
        currentRange.layout === 'timeline' ? (slot % 7) + 1 : Math.floor(slot / 7) + 1;
      const columnIndex =
        currentRange.layout === 'timeline' ? Math.floor(slot / 7) + 1 : (slot % 7) + 1;
      button.setAttribute('aria-rowindex', String(rowIndex));
      button.setAttribute('aria-colindex', String(columnIndex));
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
        const ethiopianParts = Calendar.getEthiopianParts(cursor);

        button.dataset.date = iso;
        if (level > 0) button.classList.add(`level-${level}`);
        if (isToday) {
          button.classList.add('today');
          button.setAttribute('aria-current', 'date');
        }
        if (note && (String(note.text || '').trim() || savedLevel > 0)) button.classList.add('has-note');
        if (deadlineIso && iso === deadlineIso) button.classList.add('deadline');
        if (currentRange.layout === 'calendar') {
          const dayNumber = document.createElement('span');
          dayNumber.className = 'day-number';
          dayNumber.textContent = String(ethiopianParts.day);
          button.append(dayNumber);
        }
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

    elements.dayGrid.style.setProperty('--columns', String(currentRange.columns));
    elements.dayGrid.style.setProperty('--rows', String(currentRange.rows));
    elements.dayGrid.setAttribute('aria-colcount', String(currentRange.columns));
    elements.dayGrid.setAttribute('aria-rowcount', String(currentRange.rows));
    elements.dayGrid.replaceChildren(fragment);
  }

  function fitGrid() {
    if (!currentRange || !state) return;
    const shellStyle = window.getComputedStyle(elements.widgetShell);
    const pixel = (value, fallback) => {
      const parsed = Number.parseFloat(value || '');
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const verticalPadding =
      pixel(shellStyle.paddingTop, 12) +
      pixel(shellStyle.paddingBottom, 12);
    const borderHeight =
      pixel(shellStyle.borderTopWidth, 1) +
      pixel(shellStyle.borderBottomWidth, 1);
    const width = viewportWidth();
    const isCalendar = currentRange.layout === 'calendar';
    const gap = isCalendar ? Math.max(3, Math.min(8, width / 115)) : width < 760 ? 3 : 4;
    let labelWidth = !isCalendar && state.settings.gridShowWeekdays ? 40 : 0;
    let cell;
    let weekdayHeight = 0;
    let monthHeight = 0;

    if (isCalendar) {
      cell = Math.max(34, Math.min(112, (width - gap * 6) / 7));
      weekdayHeight = state.settings.gridShowWeekdays
        ? Math.max(20, Math.min(30, cell * 0.3))
        : 0;
      monthHeight = state.settings.gridShowMonths
        ? Math.max(22, Math.min(34, cell * 0.34))
        : 0;
    } else {
      const cellFor = (label) =>
        Math.max(6, (width - label - gap * (currentRange.columns - 1)) / currentRange.columns);
      cell = cellFor(labelWidth);
      if (state.settings.gridShowWeekdays) {
        labelWidth = Math.max(30, Math.min(54, cell * 3));
      }
      cell = cellFor(labelWidth);
      monthHeight = state.settings.gridShowMonths
        ? Math.max(18, Math.min(28, cell * 1.25))
        : 0;
    }

    const gridWidth = cell * currentRange.columns + gap * (currentRange.columns - 1);
    const gridHeight = cell * currentRange.rows + gap * (currentRange.rows - 1);
    const labelGap = weekdayHeight > 0 ? gap : 0;
    const monthGap = monthHeight > 0 ? gap : 0;
    const totalWidth = labelWidth + gridWidth;
    const totalHeight = monthHeight + monthGap + weekdayHeight + labelGap + gridHeight;
    const style = elements.fittedGrid.style;
    style.setProperty('--columns', String(currentRange.columns));
    style.setProperty('--rows', String(currentRange.rows));
    style.setProperty('--cell', `${cell}px`);
    style.setProperty('--gap', `${gap}px`);
    style.setProperty('--label-width', `${labelWidth}px`);
    style.setProperty('--month-height', `${monthHeight}px`);
    style.setProperty('--weekday-height', `${weekdayHeight}px`);
    style.setProperty('--grid-width', `${gridWidth}px`);
    style.setProperty('--grid-height', `${gridHeight}px`);
    style.width = `${totalWidth}px`;
    style.height = `${totalHeight}px`;
    elements.gridViewport.style.height = `${totalHeight}px`;

    const headerHeight = state.settings.gridShowHeader
      ? Math.max(30, elements.widgetHeader.offsetHeight || 0) + 6
      : 0;
    const legendHeight = state.settings.gridShowLegend
      ? Math.max(28, elements.widgetLegend.offsetHeight || 0)
      : 0;
    const preferredHeight = Math.ceil(
      verticalPadding + borderHeight + headerHeight + totalHeight + legendHeight
    );
    api.fitWidget?.('grid', preferredHeight);
  }

  function handleResize() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      if (!state || !currentRange) return;
      const nextSpan = state.settings.gridView === 'year' ? adaptiveMonthSpan() : currentRange.monthSpan;
      if (state.settings.gridView === 'year' && nextSpan !== currentRange.monthSpan) render();
      else fitGrid();
    });
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
    const preferredTop = rect.top - tooltipRect.height - 7;
    const top = preferredTop >= 5 ? preferredTop : rect.bottom + 7;
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
    resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(elements.gridViewport);
    window.addEventListener('resize', handleResize);
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
