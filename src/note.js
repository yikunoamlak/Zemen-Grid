(function startNoteWindow() {
  'use strict';

  const Calendar = window.ZemenCalendar;
  const api = window.zemen;
  const iso = new URLSearchParams(window.location.search).get('date') || '';
  const elements = Object.fromEntries(
    [
      'cancel-note',
      'delete-note',
      'note-date',
      'note-gregorian',
      'note-text',
      'save-note'
    ].map((id) => [
      id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase()),
      document.getElementById(id)
    ])
  );
  let state = null;

  function resolvedTheme() {
    if (state.settings.theme !== 'system') return state.settings.theme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyAppearance() {
    document.body.dataset.theme = resolvedTheme();
    document.documentElement.style.setProperty('--accent', state.settings.accent);
  }

  function renderNote() {
    const date = Calendar.fromISODate(iso);
    const note = state.notes[iso] || {};
    elements.noteDate.textContent = Calendar.formatEthiopianShort(date, state.settings.language);
    elements.noteGregorian.textContent = Calendar.formatGregorian(date);
    elements.noteText.value = String(note.text || '');
    const level = Math.max(0, Math.min(4, Number(note.level) || 0));
    const input = document.querySelector(`input[name="note-level"][value="${level}"]`);
    if (input) input.checked = true;
    elements.deleteNote.classList.toggle('hidden', !state.notes[iso]);
  }

  async function saveNote() {
    const selected = document.querySelector('input[name="note-level"]:checked');
    const level = Number(selected?.value || 0);
    await api.setNote(iso, {
      text: elements.noteText.value.trim(),
      level
    });
    api.closeNote();
  }

  function bindEvents() {
    elements.saveNote.addEventListener('click', saveNote);
    elements.cancelNote.addEventListener('click', () => api.closeNote());
    elements.deleteNote.addEventListener('click', async () => {
      await api.deleteNote(iso);
      api.closeNote();
    });
    elements.noteText.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        saveNote();
      }
    });
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state?.settings.theme === 'system') applyAppearance();
    });
    api.onState((nextState) => {
      state = nextState;
      applyAppearance();
    });
  }

  async function initialize() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('Invalid note date');
    state = await api.getState();
    bindEvents();
    applyAppearance();
    renderNote();
    elements.noteText.focus();
  }

  initialize().catch((error) => {
    console.error(error);
    elements.noteDate.textContent = 'This day could not be opened';
  });
})();
