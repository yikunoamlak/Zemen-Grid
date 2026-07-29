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

  function timeParts(now) {
    const hour24 = now.getHours();
    const hour12 = hour24 % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return {
      text: state.settings.clockShowSeconds
        ? `${hour12}:${minutes}:${seconds}`
        : `${hour12}:${minutes}`,
      daypart: hour24 >= 6 && hour24 < 18 ? 'ቀን' : 'ምሽት'
    };
  }

  function renderClock() {
    if (!state) return;
    const now = new Date();
    const time = timeParts(now);
    const progress = Calendar.getYearProgress(now);
    elements.clockTime.textContent = time.text;
    elements.clockTime.dateTime = now.toISOString();
    elements.clockDaypart.textContent = time.daypart;
    elements.clockDate.textContent = Calendar.formatEthiopian(now, state.settings.language);
    elements.timezoneLabel.textContent =
      Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local timezone';
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
      pixel(shellStyle.paddingLeft, 14) +
      pixel(shellStyle.paddingRight, 14);
    const verticalPadding =
      pixel(shellStyle.paddingTop, 14) +
      pixel(shellStyle.paddingBottom, 14);
    const borderHeight =
      pixel(shellStyle.borderTopWidth, 1) +
      pixel(shellStyle.borderBottomWidth, 1);
    const width =
      elements.clockContent.clientWidth ||
      Math.max(280, (elements.widgetShell.clientWidth || 420) - horizontalPadding);
    const textLength = Math.max(5, elements.clockTime.textContent.length);
    const size = Math.max(44, Math.min(96, (width - 74) / (textLength * 0.56)));
    document.documentElement.style.setProperty('--clock-size', `${size}px`);
    const headerHeight = state.settings.clockShowHeader
      ? Math.max(24, elements.clockHeader.offsetHeight || 0) + 5
      : 0;
    const dateHeight = state.settings.clockShowDate ? Math.max(24, size * 0.29) : 0;
    const contentHeight = size * 1.02 + dateHeight;
    const preferredHeight = Math.ceil(
      Math.max(
        state.settings.clockShowDate ? 150 : 116,
        verticalPadding + borderHeight + headerHeight + contentHeight
      )
    );
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
