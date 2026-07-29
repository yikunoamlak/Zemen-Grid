(function startClockWidget() {
  'use strict';

  const Calendar = window.ZemenCalendar;
  const api = window.zemen;
  const elements = Object.fromEntries(
    [
      'clock-content',
      'clock-date',
      'clock-daypart',
      'clock-header',
      'clock-hover-details',
      'clock-time',
      'clock-year-progress',
      'open-controls',
      'timezone-label',
      'widget-shell'
    ].map((id) => [
      id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()),
      document.getElementById(id)
    ])
  );

  let state = null;
  let resizeObserver = null;

  function resolvedTheme() {
    if (state.settings.theme !== 'system') return state.settings.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyAppearance() {
    document.body.dataset.theme = resolvedTheme();
    document.documentElement.style.setProperty('--accent', state.settings.accent);
    elements.clockHeader.classList.toggle('hidden', !state.settings.clockShowHeader);
    elements.clockDate.classList.toggle('hidden', !state.settings.clockShowDate);
    elements.widgetShell.classList.toggle('show-hover-details', state.settings.clockHoverDetails);
  }

  const ethiopiaDateTimeFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  function ethiopiaCivilParts(now) {
    const values = {};
    for (const part of ethiopiaDateTimeFormatter.formatToParts(now)) {
      if (['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)) {
        values[part.type] = Number(part.value);
      }
    }
    return values;
  }

  function ethiopiaCalendarDate(now) {
    const parts = ethiopiaCivilParts(now);
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  }

  function daypartForHour(hour24) {
    if (hour24 >= 6 && hour24 < 12) {
      return {
        label: 'ጧት',
        range: '06:00–11:59'
      };
    }

    if (hour24 >= 12 && hour24 < 18) {
      return {
        label: 'ከሰአት',
        range: '12:00–17:59'
      };
    }

    if (hour24 >= 18) {
      return {
        label: 'ምሽት',
        range: '18:00–23:59'
      };
    }

    return {
      label: 'ሌሊት',
      range: '00:00–05:59'
    };
  }

  function timeParts(now) {
    const parts = ethiopiaCivilParts(now);
    const hour24 = parts.hour;

    /*
     * Ethiopian clock:
     * 06:00 civil time = 12:00 Ethiopian time
     * 12:00 civil time = 6:00 Ethiopian time
     */
    const ethiopianHour = ((hour24 + 5) % 12) + 1;

    const minutes = String(parts.minute).padStart(2, '0');
    const seconds = String(parts.second).padStart(2, '0');
    const daypart = daypartForHour(hour24);

    return {
      text: state.settings.clockShowSeconds
        ? `${ethiopianHour}:${minutes}:${seconds}`
        : `${ethiopianHour}:${minutes}`,

      daypart: daypart.label,
      daypartRange: daypart.range
    };
  }

  function renderClock() {
    if (!state) return;
    const now = new Date();
    const time = timeParts(now);
    const ethiopianDate = ethiopiaCalendarDate(now);
    const progress = Calendar.getYearProgress(ethiopianDate);
    elements.clockTime.textContent = time.text;
    elements.clockTime.dateTime = now.toISOString();
    elements.clockDaypart.textContent = time.daypart;
    elements.clockDaypart.title =
      `${time.daypart} · ${time.daypartRange}`;

    elements.clockDaypart.setAttribute(
      'aria-label',
      `${time.daypart}, ${time.daypartRange}`
    );
    elements.clockDate.textContent = Calendar.formatEthiopianShort(ethiopianDate, state.settings.language);
    elements.timezoneLabel.textContent = 'Africa/Addis_Ababa · UTC+3';
    elements.clockYearProgress.textContent = `Day ${progress.dayNumber} of ${progress.totalDays} · ${progress.daysLeft} days left`;
    fitClock();
  }

  function fitClock() {
    if (!state) return;
    const shellStyle = window.getComputedStyle(elements.widgetShell);
    const pixel = (value, fallback) => {
      const parsed = Number.parseFloat(value || '');
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const horizontalPadding =
      pixel(shellStyle.paddingLeft, 12) +
      pixel(shellStyle.paddingRight, 12);
    const verticalPadding =
      pixel(shellStyle.paddingTop, 10) +
      pixel(shellStyle.paddingBottom, 10);
    const borderHeight =
      pixel(shellStyle.borderTopWidth, 1) +
      pixel(shellStyle.borderBottomWidth, 1);
    const width =
      elements.clockContent.clientWidth ||
      Math.max(260, (elements.widgetShell.clientWidth || window.innerWidth || 520) - horizontalPadding);
    const characterCount = elements.clockTime.textContent.length;
    const dateAllowance = state.settings.clockShowDate ? Math.min(210, width * 0.38) : 0;
    const daypartAllowance = Math.max(
      48,
      Math.ceil(elements.clockDaypart.scrollWidth || 0) + 4
    );
    const timeWidth = Math.max(150, width - dateAllowance - daypartAllowance - 24);
    const size = Math.max(38, Math.min(82, timeWidth / (characterCount * 0.52)));
    document.documentElement.style.setProperty('--clock-size', `${size}px`);
    document.documentElement.style.setProperty('--clock-meta-size', `${Math.max(12, Math.min(17, size * 0.24))}px`);
    const headerHeight = state.settings.clockShowHeader
      ? Math.max(24, elements.clockHeader.offsetHeight || 0) + 4
      : 0;
    const contentHeight = Math.max(44, size * 1.06);
    const preferredHeight = Math.ceil(verticalPadding + borderHeight + headerHeight + contentHeight);
    api.fitWidget?.('clock', preferredHeight);
  }

  function bindEvents() {
    elements.openControls.addEventListener('click', () => api.showController());
    elements.clockContent.addEventListener('dblclick', () => api.showController());
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state?.settings.theme === 'system') applyAppearance();
    });
    api.onState((nextState) => {
      state = nextState;
      applyAppearance();
      renderClock();
    });
    resizeObserver = new ResizeObserver(fitClock);
    resizeObserver.observe(elements.clockContent);
    window.addEventListener('resize', fitClock);
  }

  async function initialize() {
    state = await api.getState();
    bindEvents();
    applyAppearance();
    renderClock();
    window.setInterval(renderClock, 1000);
  }

  initialize().catch((error) => {
    console.error(error);
    elements.clockTime.textContent = '--:--';
    elements.clockDate.textContent = 'Clock unavailable';
  });
})();
