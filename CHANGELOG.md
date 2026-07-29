# Changelog

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
