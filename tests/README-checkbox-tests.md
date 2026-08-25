# Checkbox CSS Regression Tests

## Problem
Checkboxes in the options page were made non-functional by CSS rules that applied `appearance: none` to all input elements, including checkboxes.

## Root Cause
In `jquery-ui-overrides.css`, the Safari input styling rule was applying `-webkit-appearance: none` to ALL inputs inside `.ui-widget` containers:

```css
.ui-widget input,
.ui-widget select,
.ui-widget textarea {
	-webkit-appearance: none !important;
	border: 1px solid var(--color-border) !important;
}
```

The `appearance: none` property removes the native browser styling from form controls. For text inputs, this is fine, but for checkboxes and radio buttons, it makes them invisible or non-functional.

## Solution
Modified the selector to exclude checkboxes and radio buttons:

```css
.ui-widget input:not([type="checkbox"]):not([type="radio"]),
.ui-widget select,
.ui-widget textarea {
	-webkit-appearance: none !important;
	border: 1px solid var(--color-border) !important;
}
```

Also ensured `fieldset` elements have `pointer-events: auto` in `components.css`:

```css
fieldset {
  ...
  pointer-events: auto !important;
}
```

## Test Coverage
Created `tests/css-checkbox.test.js` with 17 tests covering:

### CSS Rule Verification (3 tests)
- ✅ Verifies that `appearance: none` excludes checkboxes
- ✅ Verifies inputs have `pointer-events: auto`
- ✅ Verifies fieldsets have `pointer-events: auto`

### Checkbox DOM Functionality (6 tests)
- ✅ Programmatic checkbox toggling
- ✅ Click event handling
- ✅ Checkboxes inside `.ui-widget` containers
- ✅ Checkboxes inside `fieldset` elements
- ✅ All checkboxes can be checked
- ✅ All checkboxes can be unchecked

### Label Association (3 tests)
- ✅ Labels properly associated with checkboxes
- ✅ Clicking labels toggles checkboxes
- ✅ Checkboxes inside `.nowrap-item` spans work

### Multiple Checkbox Handling (2 tests)
- ✅ Independent toggling of multiple checkboxes
- ✅ Day checkboxes work independently

### Regression Prevention (3 tests)
- ✅ No `appearance: none` on checkbox selectors
- ✅ No `pointer-events: none` on fieldsets
- ✅ No `opacity: 0` on fieldsets or checkboxes

## Running Tests
```bash
# Run all tests
npm test

# Run only checkbox tests
npm test tests/css-checkbox.test.js
```

## Files Modified
- `jquery-ui-overrides.css` - Fixed Safari input styling to exclude checkboxes
- `components.css` - Added `pointer-events: auto` to fieldsets
- `tests/css-checkbox.test.js` - New comprehensive test suite (17 tests)
