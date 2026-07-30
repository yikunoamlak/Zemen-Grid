# Changelog

## 2.5.0 — 2026-07-30

Widget cards cleaned up, Appearance collapsible, cleaner segmented controls, and faithful original logo with theme switching.

### Changed

- **Original logo restored as inline SVG** — the exact `assets/icon.svg` design is now
  inlined in the HTML with CSS variables (`--panel-strong`, `--border`, `--accent`, `--text`)
  so it switches colors with dark/light/system themes without redesigning the artwork.
- **Show buttons removed from widget cards** — each widget card now shows only the icon,
  label, and toggle switch (the Show button is gone).
- **Segmented control accent border removed** — active buttons (Theme: System/Dark/Light,
  Grid view: Year/Month/Week) no longer have the `inset 0 -2px` colored bottom border.
- **Appearance section is now collapsible** — wraps in `<details>` like Grid widget and
  Clock widget sections, reducing initial scroll distance.

### Removed

- `#show-grid`, `#show-clock` buttons, their JS event handlers, and the associated test.

## 2.4.1 — 2026-07-30

Interaction polish, Windows 11 design alignment, and Win+D desktop-mode fix.

### Fixed

- **Win+D (Show Desktop) no longer hides widgets in desktop mode** — event listeners for
  `hide` and `minimize` on widget windows immediately restore visibility; 50 ms watchdog
  polling handles edge cases.

### Fluent Iconography

- **Logo now responds to theme** — the title-bar icon is an inline SVG that uses
  `currentColor` (text color) and `var(--accent)` so it automatically adapts to
  dark / light / system themes.
- **All SVG icons redesigned to Fluent System style** — consistent 1.5 px stroke,
  `stroke-linecap="round"`, `stroke-linejoin="round"`, modern metaphors:
  - Settings gear replaced with clean crosshair + circle indicator
  - Chevrons simplified to single-stroke arrows
  - Grid card icon now shows a calendar preview with an accent-colored dot
  - Clock card icon has a refined hand + tick layout
- Removed dead `.grid-icon` / `.clock-icon` CSS classes.

### Readable Typography

- Bumped minimum font size from 9–10 px to **12 px** across the entire app:
  - `.field-label`, `.stacked-field > span`: 11→13 px
  - `.details-tip`, `.deadline-preview`: 10→13 px
  - `.control-footer`: 10→13 px
  - `.toast`: 9→12 px
  - `.widget-legend`: 10→12 px
  - `.day-tooltip span`, `.day-tooltip p`: 10→12 px
  - `.note-hint`: 9→12 px
  - `.intensity-field legend`, `.note-label`: 10→13 px
  - `.note-heading > span`: 10→13 px
  - Note buttons: 11→13 px
  - Mobile hover-summary: 10→12 px
- All text now meets or exceeds 12 px for comfortable reading at 100% scaling.

### Windows 11 Design Alignment

- **Removed visual separator** between setting-rows and field-groups — the Appearance
  section is now a unified Win11 settings surface with less visual noise.
- **Widget nav SVG strokes** unified to 1.5 px (was 1.35) for consistency with Fluent.
- Segoe UI Variable Display properly scoped to headings only.

### UI Polish (previous batch)

- Thin rounded scrollbars on controller (6 px) and widgets (4 px).
- Missing `:hover` / `:active` / `:focus` states on all controls.
- Switch: 38×20 px (was 34×19), 14 px knob with hover glow.
- Color swatches: 30 px with scale(1.11) hover.
- Intensity radios: 32 px with scale(1.08) hover.
- Button disabled state (`opacity: 0.4`).
- Accent focus ring on inputs and textareas (WinUI 3 style).
- `desktopMode` label clarified.

### Files changed

`electron/main.js`, `styles.css`, `widget.css`, `index.html`, `clock.html`,
`grid.html`, `package.json`, `CHANGELOG.md`

---

## 2.4.0 — 2026-07-30

Performance, security, desktop mode, and polish release.

### New — Desktop Widget Mode

- **Desktop mode** — pins widgets behind normal windows and above the desktop wallpaper.
  Widgets are non-focusable (click-through on transparent areas).
  Controller auto-hides to tray; all settings accessible from the tray icon.
- Toggle from the **settings panel** or the **tray context menu**.

### Tray-first UX

- App now starts with only **widgets visible** — the controller stays hidden by default.
- Tray icon gets a comprehensive menu: widget visibility, grid view, always-on-top,
  desktop mode, theme (system/dark/light), check for updates, and quit.
- `controllerOnLaunch` defaults to `false`; can be re-enabled in settings.

### Performance

- Replaced `JSON.parse(JSON.stringify(...))` with native `structuredClone()` — faster,
  less memory pressure, especially for state with many notes.
- State file writes debounced from 160 ms → 500 ms — fewer I/O operations on rapid toggles.
- Cached computed clock-padding values — `getComputedStyle` calls reduced from every
  second to only on setting changes.
- Removed duplicate `matchMedia` listeners across all 4 render windows — the
  `api.onState` broadcast already handles theme changes.
- Calendar year-start cache capped at 20 entries to prevent unbounded memory growth.
- Broadcast loops use `for...of` instead of `forEach` for faster iteration.

### Security

- Added `Cross-Origin-Opener-Policy: same-origin` to all HTML pages.
- Added `Cross-Origin-Embedder-Policy: require-corp` to all HTML pages.
- Added `Referrer-Policy: no-referrer` to all HTML pages.
- Defense-in-depth: note window validates ISO date parameter before use.

### Auto-Update

- Tray tooltip shows download progress during update (e.g. "downloading 45%").
- Automatic retry with exponential backoff on update-check failures
  (up to 3 retries: 5 s, 10 s, 20 s).

### UI Polish

- `title-tag` font size reduced from 28 px → 22 px for better visual hierarchy.
- Switch toggle knob position corrected (`translateX(15)` → `17 px`).
- Color swatch buttons use `28 px` (was `29 px`) for cleaner geometry.
- Deadline grid column fractions simplified to `1fr 1.5fr 1fr` from arbitrary ratios.
- Consolidated duplicate `prefers-reduced-motion` and `body[data-theme="light"]`
  blocks in `styles.css` (removed ~30 lines of dead overrides).
- Note window intensity-option corners now use the Win11 radius token.

### Files changed

`clock.html`, `electron/main.js`, `grid.html`, `index.html`, `note.html`,
`src/calendar.js`, `src/clock-widget.js`, `src/controller.js`,
`src/grid-widget.js`, `src/note.js`, `styles.css`, `widget.css`,
`package.json`, `CHANGELOG.md`

---

## 2.3.0 — 2026-07-29

Four-interval Amharic daypart system and full Windows 11 design alignment.

### Clock

- Replaced the old two-interval daypart approach (`ቀን`/`ሌሊት`) with four culturally accurate Amharic labels
- Addis Ababa 06:00–11:59 → `ጧት`, 12:00–17:59 → `ከሰአት`, 18:00–23:59 → `ምሽት`, 00:00–05:59 → `ሌሊት`
- Dynamic daypart width calculation prevents `ከሰአት` from clipping the clock display
- `title` and `aria-label` attributes on the daypart span

### Windows 11 design

- **Controller** — native Mica background material on Windows 11 22H2+
- **Styles** — 8 px container/overlay corners, 4 px control corners, 83/167 ms motion, Segoe UI Variable + Ebrima font stack
- **Widgets** — Mica-like persistent surface, Acrylic overlays on hover details and tooltips
- **Typography** — sentence case throughout (no all-caps UI labels)
- Reduced-motion and responsive breakpoint support

### Files changed

`clock.html`, `electron/main.js`, `index.html`, `package.json`, `src/clock-widget.js`, `styles.css`, `tests/renderer.test.js`, `widget.css`

---

## 2.2.1 — 2026-07-29

Independent axis resize — width changes month range, height and corner radius scale in place.

- Grid widgets: width controls visible months; height and corner radius adjust to content in place
- Calendar renderer adapts to width-only changes without resetting the view
- Desktop files from 2.2.0 migrate automatically

### Files changed

`index.html`, `src/controller.js`, `src/grid-widget.js`, `tests/renderer.test.js`

---

## 2.2.0 — 2026-07-28

Responsive Fluent update — widgets scale content, not windows.

- Widgets resize content in place instead of stretching to fill the window
- Height gracefully hugs content as width changes
- Grid scales months progressively: 1 → 3 → 6 → 13 months based on width
- Week view uses seven-column layout
- Corner radius and clock height follow the scale
- High-contrast dark, light, and system themes
- WCAG AA text colors on all surfaces
- Mica background with acrylic overlays
- Hundreds grid for Pagumen (5 or 6 epagomenal days)

### Files changed

`clock.html`, `electron/main.js`, `electron/preload.js`, `index.html`, `package.json`, `src/calendar.js`, `src/clock-widget.js`, `src/controller.js`, `src/grid-widget.js`, `styles.css`, `tests/calendar.test.js`, `tests/renderer.test.js`, `widget.css`

---

## 2.1.0 — 2026-02-21

Initial release — Ethiopian calendar desktop widgets.

- Two independent always-on-top widgets: responsive calendar and Ethiopian clock
- Controller window and system-tray menu for widget visibility
- Ethiopian date conversion with Pagumen and leap-year support
- Day notes with color levels and persistent local storage
- Deadline hover countdown
- Windows and Linux portable builds
