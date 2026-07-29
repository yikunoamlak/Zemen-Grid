# Zemen Grid

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-43.2.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Version](https://img.shields.io/badge/version-2.1.0-blue)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20|%20Linux-lightgrey)]()

> **Zemen Grid** — two calm, always-on-top Ethiopian calendar desktop widgets.

A widget-first Ethiopian calendar desktop app with a frameless year-grid heatmap and a separate 12-hour clock styled with Amharic ቀን/ምሽት daypart labels.

---

## Widgets

| Widget | Description |
|--------|-------------|
| **Year Grid** | A frameless Ethiopian-calendar heatmap that scales every cell to the available window size — no horizontal scrolling ever. |
| **Local Clock** | A separate 12-hour clock with explicit Amharic ቀን (day) and ምሽት (night) labels. |

### Features

- Frameless, movable, and always-on-top
- Resize width to set scale; height auto-fits content
- Remembers position and size on relaunch
- High-contrast dark, light, and system themes (WCAG AA)
- Configurable header, month/weekday labels, legend, seconds, hover details
- Right-click either widget for quick controls
- Day notes with color levels — click a cell to edit
- Year, month, and week grid views
- Ethiopian-date deadline with hover countdown
- System-tray menu to toggle widgets, open controls, or quit

### Clock format

```
06:00–17:59  →  ቀን
18:00–05:59  →  ምሽት
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (current LTS recommended)

### Run from source

```bash
npm install
npm start
```

### Build portable executable

**Windows:**
```bash
npm run build:windows
```
or double-click `BUILD-WINDOWS.bat`. The installer appears in `dist/`.

**Linux:**
```bash
npm run build:linux
```

### Verify

```bash
npm run verify
```

Runs static analysis and automated tests covering Ethiopic conversion, Pagumen, leap years, full-year round trips, widget scaling, independent visibility, 12-hour day/night output, and shared note persistence.

---

## Development

```bash
npm install         # Install dependencies
npm start           # Launch in development mode
npm run check       # Static syntax check
npm test            # Run tests
npm run verify      # Check + test
npm run build:windows   # Windows portable build
npm run build:linux     # Linux AppImage build
```

---

## Privacy

Settings, window positions, deadlines, and notes are stored in the standard per-user application-data folder. Version 2 automatically migrates notes and compatible appearance settings from version 1. No data leaves your device.

---

## Release notes

See the [Releases](https://github.com/yikunoamlak/zemen-grid/releases) page for changelogs and downloadable binaries.

---

## License

[MIT](LICENSE) © 2026 Zemen Grid
