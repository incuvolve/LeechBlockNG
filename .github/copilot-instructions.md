# ivBlock – Copilot Instructions

ivBlock is a **WebExtension (Manifest V3)** browser extension for blocking time-wasting websites. It targets Firefox (and Safari). The entire extension lives in a single flat directory; there is no build step.

## Commands

```bash
npm test                              # Run all tests with coverage
npx jest tests/common.test.js        # Run a single test file
npx jest --testPathPattern=background # Run tests matching a pattern
```

## Architecture

The extension uses **`browser.*` APIs** (not `chrome.*`) throughout. There is no bundler; all JS files are loaded directly by the browser or by test scripts.

| File | Role |
|---|---|
| `common.js` | Shared constants (`MAX_SETS`, `TIMEDATA_LEN`, `PER_SET_OPTIONS`) and utility functions. Loaded before `background.js` in the background context (see `manifest.json`). |
| `background.js` | Service worker: blocking logic, per-second ticker, tab tracking, storage reads/writes. |
| `content.js` | Injected into every page at `document_start`. Sends `loaded` / `referrer` messages to background; renders the on-page countdown timer overlay. |
| `blocked.js` | Runs only on `blocked.html` (loaded via `*lb-custom*` URL pattern). |
| `popup.js` | Toolbar popup. |
| `options.js` | Settings page (opens in a new tab). |
| `stats.js` | Statistics page. |
| `lockdown.js` | Lockdown-mode page. |
| `override.js` | Override-mode page. |
| `add-sites.js` | Quick add-sites interface. |
| `diagnostics.js` | Diagnostics/debug page. |

### Storage

All persistent data uses `browser.storage.local` (assigned to `gStorage` in `background.js`). There is no use of `storage.sync`.

### Message passing

`content.js` → `background.js` via `browser.runtime.sendMessage`:
- `{ type: "loaded", url: document.URL }` – page has finished loading
- `{ type: "referrer", referrer: document.referrer }` – referrer URL

### Block sets

`common.js` defines `PER_SET_OPTIONS` (the schema for one block set) and `MAX_SETS = 30`. Each option entry has `{ type, def, id }` where `id` matches the form element in `options.html`. `TIMEDATA_LEN = 9` is the number of fields in a time-data record.

Block page URLs are parameterised: `blocked.html?$S&$U` (`$S` = set index, `$U` = blocked URL). The constants `DEFAULT_BLOCK_URL`, `DELAYED_BLOCK_URL`, and `PASSWORD_BLOCK_URL` in `common.js` define the templates.

## Testing conventions

- Every source file has a corresponding test in `tests/<name>.test.js`.
- Tests run in a **jsdom** environment (Jest config).
- Because source files use `browser.*` globals not available in Node, tests load the source file with **`vm.createContext` + `vm.runInContext`**, often extracting individual functions via regex before executing them. Follow this pattern when adding tests for new functions.
- Coverage is collected via V8 from all `*.js` files except `node_modules/`, `tests/`, `jest.config.js`, `GEMINI*.js`, and `jquery-ui/`.

## Key conventions

- **`browser.*` only** – never use `chrome.*`.
- **No build step** – JS/CSS/HTML files are used as-is.
- All log output is prefixed: `console.log("[ivBlock] ...")` / `console.warn("[ivBlock] ...")`.
- **i18n**: All user-visible strings go through `_locales/en/` and `_locales/de/` (English and German). Use `browser.i18n.getMessage()` in JS and `__MSG_key__` in manifest fields.
- **Themes**: `themes/default.css`, `dark.css`, `light.css`, `spruce.css` – theme switching applies one of these CSS files at runtime.
- **Regex patterns** for URL matching are defined in `common.js` (`PARSE_URL`, `ABSOLUTE_URL`, `INTERNAL_BLOCK_URL`) and precompiled in `background.js`.
- Source files carry the **MPL 2.0 header** comment.
