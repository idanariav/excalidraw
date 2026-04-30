# Architecture — @idan_ariav/excalidraw

## Monorepo layout

```
excalidraw/
├── packages/
│   ├── excalidraw/       ← the publishable React component library (this package)
│   ├── common/src/       ← shared constants, utilities, types (no React)
│   ├── element/src/      ← element logic: creation, mutation, bounds, binding
│   ├── math/src/         ← geometry primitives (points, lines, angles)
│   └── utils/src/        ← generic helpers (tree, formatting, etc.)
├── excalidraw-app/       ← excalidraw.com web app (not published, not used by plugin)
└── scripts/              ← monorepo build scripts (buildPackage.js, buildExample.mjs)
```

Internal packages are imported as `@excalidraw/common`, `@excalidraw/element`, etc.
None of these sub-packages are published to npm — only `packages/excalidraw` is.

---

## packages/excalidraw — top-level layout

```
packages/excalidraw/
├── index.tsx             ← public API: exports Excalidraw component + named types
├── entry.js              ← UMD entry (polyfills + re-exports index.tsx)
├── appState.ts           ← getDefaultAppState(), AppState shape
├── types.ts              ← AppState, UIAppState, ExcalidrawProps interfaces
├── obsidianUtils.ts      ← Obsidian-specific overrides (//zsviczian additions)
│
├── actions/              ← "Action" objects: element property changes, canvas ops
├── components/           ← React UI: App.tsx, panels, dialogs, icons
├── css/                  ← Global SCSS (styles.scss is the master stylesheet)
├── data/                 ← Serialization, restore, library, encryption, image blobs
├── fonts/                ← Font loading, subsetting, face definitions
├── renderer/             ← Canvas rendering (Renderer.ts, export.ts)
├── scene/                ← Scene graph operations (scroll, zoom, normalize)
├── hooks/                ← React hooks shared across components
├── context/              ← React contexts (ExcalidrawAPIContext, etc.)
├── locales/              ← i18n JSON files (en.json and others)
├── subset/               ← Font subsetting workers
├── tests/                ← Vitest test files
└── workers.ts            ← Web worker setup
```

---

## Key files — what they own

| File | Responsibility |
|------|---------------|
| `index.tsx` | Public exports: `<Excalidraw>` component, `MainMenu`, `WelcomeScreen`, `TTDDialog`, hooks |
| `components/App.tsx` | Root React component — owns the canvas, event loop, tool state |
| `appState.ts` | Default `AppState` — all UI-mode flags, current tool, current item styles |
| `types.ts` | `AppState`, `UIAppState`, `BinaryFiles`, `ExcalidrawProps` TypeScript interfaces |
| `obsidianUtils.ts` | Obsidian-specific helpers injected by the plugin (getHostPlugin, zoom tweaks, etc.) |
| `actions/register.ts` | `register()` — the factory that creates Action objects |
| `actions/manager.tsx` | `ActionManager` — dispatches actions, owns the action registry |
| `actions/actionProperties.tsx` | **All element-property panel actions**: font size, stroke width, fill, color, opacity, etc. |
| `components/icons.tsx` | Every SVG icon used in the UI (exported as JSX elements) |
| `components/RadioSelection.tsx` | Reusable button-group/radio selector component |
| `components/ButtonIcon.tsx` | Single icon button with optional `subtitle` label |
| `data/restore.ts` | `restoreElements()`, `restoreAppState()` — migration + validation on load |
| `data/json.ts` | `serializeAsJSON()`, `loadFromJSON()` — .excalidraw file format |
| `renderer/Renderer.ts` | Canvas paint loop — delegates to `@excalidraw/element` renderers |
| `css/styles.scss` | Master stylesheet imported by the build; add new UI styles here |

---

## packages/common — shared constants

```
packages/common/src/
├── constants.ts          ← FONT_SIZES, STROKE_WIDTH, DEFAULT_FONT_SIZE, etc.
├── colors.ts             ← Palette definitions
├── keys.ts               ← Keyboard key constants
├── utils.ts              ← arrayToMap, reduceToCommonValue, invariant, etc.
└── commonObsidianUtils.ts ← getHostPlugin() bridge to the Obsidian plugin
```

**Font size presets** (constants.ts): `FONT_SIZES = { sm:16, md:20, lg:28, xl:36 }`  
**Stroke width presets** (constants.ts): `STROKE_WIDTH = { extraThin:0.5, thin:1, bold:2, extraBold:4 }`

---

## packages/element — element logic

```
packages/element/src/
├── Scene.ts              ← Scene graph: element map, ordering, lookup
├── bounds.ts             ← Bounding box calculations
├── binding.ts            ← Arrow ↔ element binding logic
├── elbowArrow.ts         ← Elbow arrow routing
├── cropElement.ts        ← Image crop
├── delta.ts              ← Incremental state diffs (undo/redo)
└── __tests__/            ← Element-level unit tests
```

---

## The Action system

Actions are the primary way element properties are changed from the UI.

```
register({
  name: "changeXxx",
  perform(elements, appState, value) {
    return {
      elements: changeProperty(elements, appState, el => newElementWith(el, { prop: value })),
      appState: { ...appState, currentItemProp: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent({ elements, appState, updateData, app }) {
    // React component rendered in the properties sidebar
    // call updateData(value) to trigger perform()
  },
})
```

**Where to find actions by domain:**

| Domain | File |
|--------|------|
| Font size, stroke width, fill, color, opacity, roundness, font family | `actions/actionProperties.tsx` |
| Alignment, distribution | `actions/actionAlign.tsx`, `actionDistribute.tsx` |
| Copy/paste/clipboard | `actions/actionClipboard.tsx` |
| History (undo/redo) | `actions/actionHistory.tsx` |
| Canvas (zoom, reset, theme) | `actions/actionCanvas.tsx` |
| Export | `actions/actionExport.tsx` |

---

## Build outputs

| Command | Output | Used by |
|---------|--------|---------|
| `yarn build:umd` | `dist/excalidraw.production.min.js`, `dist/styles.production.css` | Obsidian plugin (reads + inlines these files) |
| `yarn build:esm` | `dist/prod/index.js`, `dist/prod/index.css` + `types/` | TypeScript consumers |

The Obsidian plugin's `rollup.config.js` hard-reads the UMD paths — always run `build:umd` before rebuilding the plugin.

---

## Fork modification pattern

All customizations added for the Obsidian fork are marked `//zsviczian`. To find every fork change:

```bash
grep -rn "//zsviczian" packages/excalidraw/
```

Obsidian-specific runtime helpers live in `obsidianUtils.ts` and `packages/common/src/commonObsidianUtils.ts`.
