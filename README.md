# Zemen Grid 2.2

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43.2.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Version](https://img.shields.io/badge/version-2.2.0-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20|%20Linux-lightgrey)]()

> **Zemen Grid** — two calm, always-on-top Ethiopian calendar desktop widgets.

A widget-first Ethiopian calendar desktop app. Runs as two independent floating surfaces:

- **Responsive calendar** — a frameless Ethiopian calendar that reveals the current month, 3 months, 6 months, or all 13 months as its width grows. Month and week views use a familiar seven-column calendar layout.
- **Ethiopian clock** — a compact Addis Ababa clock using Ethiopian clock hours with explicit `ቀን` (day) and `ሌሊት` (night) labels.

A small control center and system-tray menu turn either widget on or off. The ordinary app window is never required for the widgets to remain visible.

---

## Widget behavior

- Frameless, movable, and always-on-top
- Resize the width to set the scale; widget height automatically hugs its content
- Previous width and screen position are restored on the next launch
- High-contrast dark, light, or system theme with WCAG AA text colors
- Optional header, month labels, weekday labels, legend, date, seconds, and hover details
- Right-click either widget for quick controls
- The renderer changes only window height; the user-controlled width stays fixed
- Hover details are acrylic overlays and never reserve empty widget space
- Grid cells remain square and the height follows the selected width and visible range
- Click a day to open its persistent local note and color level
- Year, month, and week grid views
- Ethiopian-date deadline with hover countdown
- Tray menu for showing widgets, opening controls, or quitting

The clock is anchored to `Africa/Addis_Ababa` and uses Ethiopian clock hours. For example, Addis Ababa `14:00` is displayed as `8:00 ቀን`.

- Addis Ababa `06:00–17:59` → `ቀን`
- Addis Ababa `18:00–05:59` → `ሌሊት`

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (current LTS recommended)

### Run from source

```bash
npm install
npm start
```

### Build portable executable

**Windows:** double-click `BUILD-WINDOWS.bat` or run:

```bash
npm run build:windows
```

The executable appears in `dist/`.

**Linux:**

```bash
npm run build:linux
```

### Verify

```bash
npm run verify
```

Runs static analysis and automated tests covering Ethiopic conversion, Pagumen, leap years, full-year round trips, widget scaling, independent visibility, Addis Ababa clock time, and shared note persistence.

---

## Controls

- Drag widgets from their padding or visible labels.
- Resize from any window edge.
- Right-click a widget for its most useful display settings.
- Click a grid cell to edit its note.
- Click the tray icon to reopen the control center.
- Closing the control center leaves the widgets running.

---

## Privacy

Settings, window positions, deadlines, and notes are stored in the standard per-user application-data folder. Version 2.2 automatically migrates notes and compatible appearance settings from version 1. No data leaves your device.

---

## Release notes

See the [Releases](https://github.com/yikunoamlak/Zemen-Grid/releases) page for changelogs and downloadable binaries.

---

## License

[MIT](LICENSE) © 2026 Zemen Grid
