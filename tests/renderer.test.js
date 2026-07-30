const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');

function defaultState() {
  return {
    schemaVersion: 2,
    legacyMigrated: true,
    settings: {
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
      theme: 'dark'
    },
    notes: {},
    bounds: {}
  };
}

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function change(window, element) {
  element.dispatchEvent(new window.Event('change', { bubbles: true }));
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function buildPage({ htmlFile, scriptFile, state = defaultState(), query = '' }) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
  const errors = [];
  const calls = {
    closeNote: 0,
    fitWidgets: [],
    notes: [],
    openNotes: [],
    showController: 0,
    showWidgets: []
  };
  const listeners = [];
  let currentState = structuredClone(state);
  const dom = new JSDOM(html, {
    url: `https://zemen-grid.local/${htmlFile}${query}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  const { window } = dom;
  Object.defineProperty(window, 'innerWidth', { value: 1260, writable: true });

  window.console.error = (...values) => errors.push(values.join(' '));
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener() {},
    removeEventListener() {}
  });
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.ResizeObserver = class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {
      this.callback();
    }
    disconnect() {}
  };

  function emit() {
    const snapshot = structuredClone(currentState);
    listeners.forEach((listener) => listener(snapshot));
  }

  window.zemen = {
    async getState() {
      return structuredClone(currentState);
    },
    async patchSettings(patch) {
      currentState.settings = { ...currentState.settings, ...patch };
      emit();
      return structuredClone(currentState);
    },
    async setNote(iso, note) {
      currentState.notes[iso] = { ...note };
      calls.notes.push({ iso, note: { ...note } });
      emit();
      return structuredClone(currentState);
    },
    async deleteNote(iso) {
      delete currentState.notes[iso];
      emit();
      return structuredClone(currentState);
    },
    async migrateLegacy() {
      currentState.legacyMigrated = true;
      return structuredClone(currentState);
    },
    async showController() {
      calls.showController += 1;
    },
    async showWidget(type) {
      currentState.settings[`${type}Visible`] = true;
      calls.showWidgets.push(type);
      emit();
    },
    async openNote(iso) {
      calls.openNotes.push(iso);
    },
    async closeNote() {
      calls.closeNote += 1;
    },
    async fitWidget(type, height) {
      calls.fitWidgets.push({ type, height });
      return { width: type === 'grid' ? 1040 : 420, height };
    },
    async getVersion() {
      return '2.0.0';
    },
    onState(callback) {
      listeners.push(callback);
      return () => {};
    }
  };

  window.eval(fs.readFileSync(path.join(root, 'src', 'calendar.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, scriptFile), 'utf8'));
  await tick();
  await tick();
  return {
    calls,
    document: window.document,
    dom,
    errors,
    getState: () => structuredClone(currentState),
    window
  };
}

test('controller manages independent widgets and appearance', async () => {
  const app = await buildPage({ htmlFile: 'index.html', scriptFile: 'src/controller.js' });
  const { document, window } = app;
  assert.equal(document.getElementById('grid-visible').checked, true);
  assert.equal(document.getElementById('clock-visible').checked, true);
  assert.match(document.getElementById('current-ethiopian-year').textContent, /\d{4}/);
  assert.equal(app.errors.length, 0);

  const gridToggle = document.getElementById('grid-visible');
  gridToggle.checked = false;
  change(window, gridToggle);
  await tick();
  assert.equal(app.getState().settings.gridVisible, false);

  click(window, document.querySelector('[data-theme-value="light"]'));
  await tick();
  assert.equal(app.getState().settings.theme, 'light');
  assert.equal(document.body.dataset.theme, 'light');

  app.dom.window.close();
});

test('grid widget fits the complete year at a wide width without scrolling', async () => {
  const app = await buildPage({ htmlFile: 'grid.html', scriptFile: 'src/grid-widget.js' });
  const { document, window } = app;
  const Calendar = window.ZemenCalendar;
  const current = Calendar.getEthiopianParts(new Date());
  const expectedDays = Calendar.getYearLength(current.year);

  assert.equal(document.querySelectorAll('.day-cell[data-date]').length, expectedDays);
  assert.equal(document.querySelectorAll('.month-label').length, 13);
  assert.equal(document.querySelector('.heatmap-scroll'), null);
  assert.equal(document.getElementById('widget-header').classList.contains('hidden'), true);
  assert.equal(document.getElementById('widget-legend').classList.contains('hidden'), true);
  assert.ok(Number.parseFloat(document.getElementById('fitted-grid').style.getPropertyValue('--cell')) > 0);
  assert.match(document.getElementById('fitted-grid').style.width, /px$/);
  assert.equal(app.errors.length, 0);

  click(window, document.querySelector('.day-cell.today'));
  await tick();
  assert.deepEqual(app.calls.openNotes, [Calendar.toISODate(new Date())]);
  app.dom.window.close();
});


test('year timeline reveals 1, 3, 6, and all 13 months as width grows', async () => {
  const app = await buildPage({ htmlFile: 'grid.html', scriptFile: 'src/grid-widget.js' });
  const { document, window } = app;

  async function resizeTo(width) {
    window.innerWidth = width;
    window.dispatchEvent(new window.Event('resize'));
    await tick();
    await tick();
  }

  await resizeTo(400);
  assert.equal(document.querySelectorAll('.month-label').length, 1);

  await resizeTo(650);
  assert.equal(document.querySelectorAll('.month-label').length, 3);

  await resizeTo(900);
  assert.equal(document.querySelectorAll('.month-label').length, 6);

  await resizeTo(1300);
  assert.equal(document.querySelectorAll('.month-label').length, 13);
  app.dom.window.close();
});

test('month and week views use a seven-column calendar layout', async () => {
  const state = defaultState();
  state.settings.gridView = 'month';
  const app = await buildPage({ htmlFile: 'grid.html', scriptFile: 'src/grid-widget.js', state });
  const { document } = app;
  assert.equal(document.getElementById('fitted-grid').classList.contains('calendar-layout'), true);
  assert.equal(document.getElementById('day-grid').getAttribute('aria-colcount'), '7');
  assert.ok(document.querySelectorAll('.day-number').length >= 28);

  await app.window.zemen.patchSettings({ gridView: 'week' });
  await tick();
  assert.equal(document.getElementById('day-grid').getAttribute('aria-colcount'), '7');
  assert.equal(document.getElementById('day-grid').getAttribute('aria-rowcount'), '1');
  app.dom.window.close();
});

test('clock widget uses Addis Ababa Ethiopian clock time and an inline date', async () => {
  const app = await buildPage({ htmlFile: 'clock.html', scriptFile: 'src/clock-widget.js' });
  const { document } = app;
  const addisParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US-u-nu-latn', {
      timeZone: 'Africa/Addis_Ababa',
      hour: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(new Date())
      .filter((part) => part.type === 'hour')
      .map((part) => [part.type, Number(part.value)])
  );
  const expectedHour = ((addisParts.hour + 5) % 12) + 1;
  const displayedHour = Number(document.getElementById('clock-time').textContent.split(':')[0]);
  const { hour } = addisParts;
  const expectedDaypart =
    hour >= 6 && hour < 12
      ? 'ጧት'
      : hour >= 12 && hour < 18
        ? 'ከሰአት'
        : hour >= 18
          ? 'ምሽት'
          : 'ሌሊት';

  assert.match(document.getElementById('clock-time').textContent, /^(?:[1-9]|1[0-2]):\d{2}:\d{2}$/);
  assert.equal(displayedHour, expectedHour);
  assert.equal(document.getElementById('clock-daypart').textContent, expectedDaypart);
  assert.equal(document.getElementById('clock-date').parentElement.classList.contains('clock-line'), true);
  assert.equal(document.getElementById('clock-header').classList.contains('hidden'), true);
  assert.ok(app.calls.fitWidgets.some(({ type, height }) => type === 'clock' && height >= 80 && height < 150));
  assert.equal(app.errors.length, 0);

  await app.window.zemen.patchSettings({ clockShowSeconds: false });
  await tick();
  assert.match(document.getElementById('clock-time').textContent, /^(?:[1-9]|1[0-2]):\d{2}$/);
  app.dom.window.close();
});

test('light and dark widget text colors meet WCAG AA contrast', () => {
  function luminance(hex) {
    const channels = hex
      .match(/[0-9a-f]{2}/gi)
      .map((value) => Number.parseInt(value, 16) / 255)
      .map((value) =>
        value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      );
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(foreground, background) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }

  const pairs = [
    ['#ffffff', '#1f1f1f'],
    ['#c7c7c7', '#1f1f1f'],
    ['#9b9b9b', '#1f1f1f'],
    ['#1a1a1a', '#f9f9f9'],
    ['#5d5d5d', '#f9f9f9'],
    ['#737373', '#f9f9f9']
  ];
  pairs.forEach(([foreground, background]) => {
    assert.ok(contrast(foreground, background) >= 4.5);
  });
});

test('day note window saves through shared persistent state', async () => {
  const Calendar = require('../src/calendar.js');
  const iso = Calendar.toISODate(new Date());
  const app = await buildPage({
    htmlFile: 'note.html',
    scriptFile: 'src/note.js',
    query: `?date=${iso}`
  });
  const { document, window } = app;
  document.getElementById('note-text').value = 'A calm milestone';
  document.querySelector('input[name="note-level"][value="3"]').checked = true;
  click(window, document.getElementById('save-note'));
  await tick();
  assert.equal(app.calls.notes[0].iso, iso);
  assert.deepEqual(app.calls.notes[0].note, { text: 'A calm milestone', level: 3 });
  assert.equal(app.calls.closeNote, 1);
  assert.equal(app.errors.length, 0);
  app.dom.window.close();
});
