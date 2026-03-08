# ivBlock - Copilot Instructions

## 1. Project Overview

**ivBlock** is a browser extension productivity tool designed to block time-wasting websites. It allows users to specify which sites to block and when to block them (time-based rules, daily schedules, time limits, etc.).

**Type:** WebExtension (Manifest V3) - Works on Firefox and Chrome-based browsers  
**License:** Mozilla Public License v2.0  
**Author:** Michael Hülsen  
**Version:** 1.0.2

### Key Features:
- Time-based site blocking with customizable schedules
- Multiple block sets (up to 30) with different rules
- Time limit enforcement (daily/weekly limits)
- Override/lockdown modes with password protection
- Delay pages before allowing access
- Statistics tracking
- Theme support (light, dark, default, spruce)
- i18n support (English, German)
- Custom blocking messages and CSS filters
- Password/access code protection for settings

---

## 2. Build/Test/Lint Commands

### Available npm Scripts (from `package.json`):
```json
{
  "scripts": {
    "test": "jest"
  }
}
```

### Test Execution:
- **Run all tests:** `npm test` or `jest`
  - Runs tests in jsdom environment with coverage collection
  - Coverage reports generated in `/coverage` directory
  - Excludes: `node_modules/`, `tests/` directory, `jest.config.js`, files matching `GEMINI*.js`, `jquery-ui/`

### Single Test Run:
```bash
npm test -- tests/common.test.js          # Run specific test file
npm test -- --testNamePattern="cleanSites" # Run test matching pattern
npm test -- --watch                       # Watch mode
```

### Jest Configuration (`jest.config.js`):
- **Test Environment:** jsdom (DOM simulation)
- **Coverage Provider:** v8
- **Babel Transpilation:** Enabled (via babel-jest and @babel/preset-env)

---

## 3. Architecture

### Project Structure Overview

```
ivBlockCore/
├── manifest.json              # WebExtension manifest (v3)
├── common.js                  # Shared utilities & constants (621 lines)
├── background.js              # Service worker (1976 lines)
├── content.js                 # Content script injected in web pages (239 lines)
├── popup.js                   # Popup UI logic (134 lines)
├── options.js                 # Options page logic (1429 lines)
├── add-sites.js               # Add sites dialog (119 lines)
├── blocked.js                 # Blocking page logic (188 lines)
├── lockdown.js                # Lockdown mode page (185 lines)
├── override.js                # Override mode page (364 lines)
├── stats.js                   # Statistics page (168 lines)
├── diagnostics.js             # Diagnostics page (120 lines)
├── [name].html                # Corresponding HTML files for each JS
├── [name].css                 # Style files
├── _locales/                  # i18n messages (en, de)
├── themes/                    # CSS themes (dark.css, default.css, light.css, spruce.css)
├── tests/                     # Jest test files (12 test files)
├── jest.config.js             # Jest configuration
├── jest.setup.js              # Jest setup file (empty)
└── package.json               # Dependencies and scripts
```

### Main Components & Responsibilities

| File | Lines | Role |
|------|-------|------|
| **common.js** | 621 | Shared constants, utilities, URL parsing, options validation, time period handling, regex generation |
| **background.js** | 1976 | Service worker - Main logic: tab tracking, site blocking, storage management, message dispatch |
| **content.js** | 239 | Content script injected on every page - Sends loaded/focus notifications, applies filters |
| **popup.js** | 134 | Extension popup UI - Opens options, stats, lockdown, override, add-sites pages |
| **options.js** | 1429 | Settings page - Form handling, import/export, theme selection, password setup, multi-set configuration |
| **blocked.js** | 188 | Blocking page - Displays blocked message, custom content, password protection |
| **override.js** | 364 | Override mode - Time-limited bypass of blocking, access control |
| **lockdown.js** | 185 | Lockdown mode - Forces blocking, disables overrides |
| **stats.js** | 168 | Statistics page - Shows time tracking data |
| **add-sites.js** | 119 | Quick add dialog - Adds current site to block set |
| **diagnostics.js** | 120 | Debug information page |

### Data Flow & Message Passing

#### 1. **Background → Content Script Communication**
```javascript
// Background sends message to content script (background.js)
browser.tabs.sendMessage(id, {
  type: "alert" | "filter" | "keyword" | "ping",
  ...otherData
}).catch(error => {});

// Content script listens (content.js, line 221)
browser.runtime.onMessage.addListener(handleMessage);
```

**Message Types:**
- `alert` - Show alert on page
- `filter` - Apply CSS filter (grayscale, etc.)
- `keyword` - Check keyword in page title/content
- `ping` - Notify page loaded

#### 2. **Content Script → Background Communication**
```javascript
// Content script sends to background (content.js, lines 21, 24, 202, 206)
browser.runtime.sendMessage({
  type: "loaded",      // Page finished loading
  type: "referrer",    // Page referrer
  type: "focus",       // Tab focused/unfocused (true/false)
  focus: boolean
});
```

#### 3. **Popup/Options/Pages → Background**
```javascript
// UI pages send messages (via browser.runtime.sendMessage)
// Background handler dispatches (background.js, line 1698)
browser.runtime.onMessage.addListener(handleMessage);

// Message types from blocking pages:
case "add-sites"      // Add sites to block set
case "blocked"        // Request block info
case "close"          // Close tab
case "delayed"        // Delay period complete
case "override"       // Override request
case "password"       // Password verification
case "lockdown"       // Lockdown mode request
case "stats"          // Statistics request
```

### manifest.json Details

**Manifest Version:** 3 (MV3 - modern standard)

**Key Permissions:**
- `alarms` - Schedule tasks
- `menus` - Context menu (right-click menu)
- `downloads` - Export functionality
- `storage` - Persistent data storage
- `tabs` - Tab management and messaging
- `unlimitedStorage` - Unlimited storage quota
- `webNavigation` - Track page navigation
- `<all_urls>` (host_permissions) - Access all websites

**Optional Permissions:**
- `history` - Access browsing history

**Content Security Policy:**
- `script-src 'self'` - Only extension scripts allowed
- `object-src 'self'` - Only extension objects
- `child-src 'self' blob:` - Blob support for iframes

**Content Scripts:**
1. Main content script: Matches `<all_urls>` except `*://*/*lb-custom*`, runs at `document_start`
2. Blocking page script: Matches `*://*/*lb-custom*` URLs only

### Storage Architecture

**Storage Type Selection** (background.js, lines 196-201):
```javascript
browser.storage.local.get("sync").then(onGotSync);
// If sync: true → use browser.storage.sync (syncs across devices)
// If sync: false → use browser.storage.local (device-only)
```

**Stored Data Structure:**
- **General Options** (GENERAL_OPTIONS in common.js, ~60 properties):
  - `numSets` - Number of block sets (1-30)
  - `sync` - Storage sync mode
  - `theme` - Current theme
  - `password` - Access password
  - `customStyle` - Custom CSS
  - Various timer, access, and feature flags

- **Per-Set Options** (PER_SET_OPTIONS in common.js, ~50 properties per set):
  - `setName1`, `setName2`, ... - Block set names
  - `sites1`, `sites2`, ... - Comma-separated blocked sites
  - `times1`, `times2`, ... - Time periods (e.g., "0900-1230,1330-1700")
  - `limitMins1`, ... - Time limit in minutes
  - `days1`, ... - Array of 7 booleans (Sun-Sat)
  - `blockURL1`, ... - Custom block page URL
  - `passwordRequire1`, ... - Password requirement level
  - `applyFilter1`, ... - CSS filter application
  - Many more per-set configurations...

- **Time Data** (tracked per set):
  ```javascript
  const TIMEDATA_LEN = 9;
  // [0] = stats start time
  // [1] = total time spent
  // [2] = limit period start
  // [3] = time during limit period
  // [4] = lockdown end time
  // [5] = rollover time
  // [6] = next rollover time
  // [7] = rollover period start
  // [8] = minimum block end time
  ```

### How Blocking Works

1. **Page Load Interception:**
   - Content script loads at `document_start` (before page renders)
   - Notifies background script via `browser.runtime.sendMessage`

2. **Background Processing:**
   - Checks tab's URL against all active block sets
   - Evaluates time periods and daily schedules
   - Checks time limits and override status

3. **Block Decision & Enforcement:**
   - If blocked: Navigates tab to blocking page (`blocked.html`, `delayed.html`, or `password.html`)
   - Passes block info via URL parameters (`?$S&$U`)
   - Content script applies CSS filters if configured

4. **Blocking Page Response:**
   - `blocked.js` processes block info
   - Displays custom message or shows delay countdown
   - May require password for unblocking
   - Communicates back to background for override/unlock

### Key Global Variables (background.js)

```javascript
var gStorage = browser.storage.local;    // Current storage backend
var gOptions = {};                        // Loaded options
var gTabs = [];                          // Tab tracking data [tabId]
var gSetCounted = [];                    // Which set is active per tab
var gSavedTimeData = [];                 // Time tracking data
var gRegExps = [];                       // Compiled regex patterns
var gActiveTabId = 0;                    // Currently focused tab
var gFocusWindowId = 0;                  // Currently focused window
var gOverrideIcon = false;               // Override mode icon display
var gTickerID;                           // Interval ID for main timer loop
var gTickerSecs = 1;                     // Timer update frequency (seconds)
var gDiagMode = false;                   // Diagnostics mode flag
```

---

## 4. Key Conventions and Patterns

### Test Organization

**Test Directory:** `/tests/` (12 test files)

**Test Files:**
```
tests/
├── add-sites.test.js         (10,506 bytes)
├── background.test.js        (2,280 bytes)
├── blocked.test.js           (8,346 bytes)
├── buttons.test.js           (1,241 bytes)
├── common.test.js            (3,703 bytes) ✓ Common utilities
├── content.test.js           (10,456 bytes)
├── diagnostics.test.js       (6,744 bytes)
├── lockdown.test.js          (7,510 bytes)
├── options.test.js           (15,169 bytes) - Largest
├── override.test.js          (8,455 bytes)
├── popup.test.js             (7,624 bytes)
└── stats.test.js             (10,130 bytes)
```

**Testing Framework:** Jest (v30.0.5)

**Test Pattern Example** (from `common.test.js`):
```javascript
describe('common.js tests', () => {
  describe('cleanSites', () => {
    it('should remove extra whitespace and sort sites', () => {
      expect(cleanSites('  site2.com   site1.com  ')).toBe('site1.com site2.com');
    });
  });
});
```

**Test Structure:**
- Uses `describe()` blocks for test suites
- Uses `it()` for individual tests
- Jest matchers: `expect().toBe()`, `expect().toEqual()`, etc.
- VM context setup for testing non-module code (common.js)
- jsdom environment for DOM testing

### Internationalization (i18n)

**Locales Directory:** `/_locales/`

**Supported Languages:**
- `en/messages.json` - English (default)
- `de/messages.json` - German

**Message Format (WebExtension standard):**
```json
{
  "extensionName": {
    "message": "ivBlock",
    "description": "Name of the extension."
  },
  "extensionDescription": {
    "message": "ivBlock is a simple productivity tool...",
    "description": "Description of the extension."
  }
}
```

**Usage in HTML:**
```html
<title>__MSG_extensionName__</title>
<p>__MSG_extensionDescription__</p>
```

**Locale Switching:**
- Manifest specifies `"default_locale": "en"`
- Messages loaded at runtime via `browser.i18n.getMessage()`

### CSS Architecture

**CSS Files:**
- `style.css` - Global styles
- `popup.css` - Popup UI styles
- `options.css` - Options page styles
- `content.css` - Content script styles
- `buttons.css` - Button component styles
- `controls.css` - Form control styles
- `lockdown.css` - Lockdown page styles
- `override.css` - Override page styles

**Theme System:**

Themes are CSS files in `/themes/`:
```
themes/
├── default.css    - Light default theme
├── light.css      - Light theme variant
├── dark.css       - Dark theme
└── spruce.css     - Spruce theme
```

**Theme Implementation:**
1. User selects theme in options page
2. Theme preference stored in `options["theme"]`
3. At runtime, dynamically link theme CSS:
```javascript
let link = document.getElementById("themeLink");
link.href = "/themes/" + (theme ? `${theme}.css` : "default.css");
```

### Code Style & Patterns

**Logging Convention:**
```javascript
function log(message) { 
  console.log("[ivBlock] " + message); 
}
function warn(message) { 
  console.warn("[ivBlock] " + message); 
}
```

**Error Handling:**
- Promise `.catch()` to suppress broadcast errors:
  ```javascript
  browser.tabs.sendMessage(id, message).catch(error => {});
  ```
- Graceful fallbacks for missing DOM elements:
  ```javascript
  let link = document.getElementById("themeLink");
  if (link) { link.href = "..."; }
  ```

**Async Patterns:**
- Promise-based: `.then()` / `.catch()`
- No async/await found in codebase
- Nested promise chains common

**String Escaping:**
- `\n` escaping for storage: `escape(str)` / `unescape(str)`
- URL encoding: `encodeURIComponent()`, `decodeURIComponent()`

**Regular Expressions:**
- URL parsing: `PARSE_URL` regex
- Unicode-aware word boundaries via lookarounds
- Pattern compilation in `common.js` functions

---

## 5. Other AI Configuration Files

**Checked for existence:**
- ❌ CLAUDE.md
- ❌ AGENTS.md
- ❌ .cursorrules
- ❌ .cursor/rules/
- ❌ .windsurfrules
- ❌ CONVENTIONS.md
- ❌ AIDER_CONVENTIONS.md
- ❌ .clinerules
- ❌ .cline_rules
- ❌ .github/copilot-instructions.md

**Result:** No existing AI configuration files in the repository.

---

## 6. README and Documentation

### README.md Summary

**Title:** ivBlock for Safari

**Description:** Simple productivity tool for blocking time-wasting websites.

**Key Info:**
- **Author:** Michael Hülsen
- **Badge:** Awesome Humane Tech community badge
- **Purpose:** Help users maintain productivity by blocking distracting sites on user-defined schedules

*Note: The README is minimal. The project name mentions "Safari" but manifest.json indicates broader WebExtension compatibility (Firefox, Chrome-based browsers).*

### Other Documentation Files

- `VERSIONS.md` - Version history
- `VERSIONS-ivBlock.md` - ivBlock-specific versions
- `css-refactoring.md` - CSS refactoring notes
- `_locales/gemini.md` - Locale-related documentation
- `options.js_format.txt` - Options file format documentation

### Key Files for Understanding Features

- **manifest.json** - Full extension capabilities and manifest details
- **common.js** - Option definitions and validation rules (GENERAL_OPTIONS, PER_SET_OPTIONS, TIMEDATA structure)
- **options.js** (first 100 lines) - Settings form initialization
- **background.js** (line 1698+) - Message handler switch statement documents all message types

---

## 7. Dependencies

### Development Dependencies
```json
{
  "@babel/core": "^7.28.3",
  "@babel/preset-env": "^7.28.3",
  "babel-jest": "^30.0.5",
  "jest": "^30.0.5",
  "jest-environment-jsdom": "^30.0.5"
}
```

### Production Dependencies
```json
{
  "jquery": "^3.7.1",
  "jsdom": "^26.1.0"
}
```

**jQuery Usage:** Used in options.js for DOM manipulation (e.g., `$("#form").html(...)`)

---

## 8. Development Guidelines

### When Adding Features

1. **Add Constants to common.js** - Define new option keys in GENERAL_OPTIONS or PER_SET_OPTIONS with type and default
2. **Handle in Options Form** - Add HTML inputs to `options.html` with matching IDs
3. **Add Tests** - Create test cases in appropriate `tests/*.test.js` file
4. **Document Storage** - Update storage handling in background.js if needed
5. **Add i18n Strings** - Add messages to `_locales/en/messages.json` and `_locales/de/messages.json`
6. **Style** - Add CSS to relevant CSS files (options.css, etc.)

### When Fixing Bugs

1. **Check common.js** - Many utilities are shared (URL parsing, validation, regex)
2. **Review Message Types** - Verify message passing in handleMessage functions
3. **Check Storage Initialization** - Options must be defined in GENERAL_OPTIONS or PER_SET_OPTIONS
4. **Test Storage Sync** - Both local and sync storage paths should work
5. **Verify Browser APIs** - Check manifest permissions are set

### Testing Tips

- Use `npm test` to run full suite
- jsdom provides DOM simulation - good for testing HTML/CSS changes
- Test files can use VM context to run non-module scripts (like common.js)
- Always test both storage.local and storage.sync paths

---

## 9. Important Constants & Limits

From `common.js`:

| Constant | Value | Purpose |
|----------|-------|---------|
| TIMEDATA_LEN | 9 | Number of time data fields per block set |
| MAX_SETS | 30 | Maximum number of block sets |
| ALL_DAY_TIMES | "0000-2400" | All-day block string |
| BLOCKED_PAGE | "blocked.html" | Default block page |
| DELAYED_PAGE | "delayed.html" | Delay countdown page |
| PASSWORD_PAGE | "password.html" | Password entry page |
| DEFAULT_BLOCK_URL | "blocked.html?$S&$U" | Default block redirect |
| IVBLOCK_URL | "https://www.incuvolve.de/ivblock/" | Support website |

---

## 10. Debugging & Diagnostics

**Diagnostic Mode:**
- Enabled via `diagMode` option in settings
- Provides detailed logging to console
- Access `/diagnostics.html` page

**Logging Pattern:**
- All logs prefixed with `[ivBlock]`
- Check browser console for runtime errors
- Use `background.js` line 12 `log()` function for consistent logging

**Common Issues:**
- Message passing failures → Wrapped in `.catch()` for graceful handling
- Storage sync conflicts → Check both local and sync storage
- Time calculations → Review timezone/clock offset handling in `common.js`

