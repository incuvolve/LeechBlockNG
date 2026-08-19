# UI Optimization Plan

**Last updated:** 2026-08-19  
**Status:** Phase 1, 2, 3 & 4.1 Complete ✅  
**Related:** [DESIGN_GUIDELINES.md](./DESIGN_GUIDELINES.md)

## Overview

This document provides a step-by-step plan to improve the ivBlock UI for better readability, accessibility, and maintainability. Each optimization is designed to be implemented independently by a language model with clear instructions and validation criteria.

## How to Use This Document

1. **Work sequentially** through phases (Phase 1 → Phase 2 → etc.)
2. **Each task is independent** within a phase and can be done in any order
3. **Test after each change** using the validation steps provided
4. **No build step required** - changes apply directly to CSS/HTML files
5. **Test across themes** - verify changes work with default, dark, light, and spruce themes

## Phase 1: Typography & Readability ✅ COMPLETED

### Task 1.1: Increase Base Font Size ✅

**Status:** Implemented 2026-08-19

**Goal:** Improve readability by increasing the base font size from 16px to 17px.

**Files to modify:**
- `style.css`

**Changes:**
```css
/* BEFORE (line 18-21) */
--font-size-base: 16px;
--font-size-sm: 14px;
--font-size-xs: 12px;

/* AFTER */
--font-size-base: 17px;
--font-size-sm: 15px;
--font-size-xs: 13px;
```

**Rationale:** A 1px increase in base font size significantly improves readability without breaking layouts. Proportionally adjust smaller sizes to maintain visual hierarchy.

**Validation:**
1. Open `options.html` in browser
2. Verify text is more readable without layout breaks
3. Check that labels, descriptions, and help text are clearer
4. Test across all four themes

**Expected impact:** Minimal layout changes; improved text legibility for all users.

---

### Task 1.2: Improve Line Height ✅

**Status:** Implemented 2026-08-19

**Goal:** Add more vertical space between lines of text for better readability.

**Files to modify:**
- `style.css`

**Changes:**
```css
/* Add after line 21 (font-size variables) */
--line-height-base: 1.6;
--line-height-tight: 1.4;
--line-height-relaxed: 1.8;

/* Update body rule (around line 45) */
/* BEFORE */
body {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  /* ... existing properties ... */
}

/* AFTER */
body {
  font-family: var(--font-primary);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  /* ... existing properties ... */
}
```

**Rationale:** Line height of 1.6 (vs default ~1.2) provides better readability for body text. WCAG recommends at least 1.5.

**Validation:**
1. Open `options.html` and check help text paragraphs
2. Verify descriptions under block set options are easier to read
3. Check that multi-line labels don't feel cramped
4. Test popup.html for proper spacing

**Expected impact:** More vertical space; reduced visual density; easier scanning.

---

### Task 1.3: Enhance Typography Hierarchy ✅

**Status:** Implemented 2026-08-19

**Goal:** Make headings more distinct from body text.

**Files to modify:**
- `components.css`

**Changes:**
```css
/* BEFORE (lines 243-251) */
h1 { font-size: 28px; font-weight: 400; margin: 0 0 20px 0; }
h2 { font-size: 24px; font-weight: 400; margin: 20px 0 16px 0; }
h3 { font-size: 18px; font-weight: 400; margin: 16px 0 12px 0; }

/* AFTER */
h1 {
  font-size: 32px;
  font-weight: 300;
  line-height: 1.2;
  margin: 0 0 24px 0;
  letter-spacing: -0.02em;
}

h2 {
  font-size: 24px;
  font-weight: 400;
  line-height: 1.3;
  margin: 32px 0 16px 0;
}

h3 {
  font-size: 19px;
  font-weight: 400;
  line-height: 1.4;
  margin: 24px 0 12px 0;
}
```

**Rationale:** Larger h1, tighter line-height for headings, increased top margins for better section separation.

**Validation:**
1. Check `options.html` page headers
2. Verify visual hierarchy: h1 > h2 > h3 > body text
3. Confirm spacing before h2/h3 separates sections clearly
4. Test in all themes

**Expected impact:** Clearer content structure; improved scannability.

---

### Task 1.4: Increase Label and Button Text Size ✅

**Status:** Implemented 2026-08-19

**Goal:** Make interactive elements more readable.

**Files to modify:**
- `components.css`

**Changes:**
```css
/* Find label rule (around line 92) */
/* BEFORE */
label {
  /* ... existing properties ... */
}

/* AFTER */
label {
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  /* ... existing properties ... */
}

/* Find .ivb-btn rule (around line 40) */
/* BEFORE */
.ivb-btn {
  /* ... existing properties ... */
}

/* AFTER */
.ivb-btn {
  font-size: var(--font-size-base);
  line-height: 1.4;
  /* ... existing properties ... */
}
```

**Rationale:** Labels and buttons should match or slightly exceed base font size for easy reading.

**Validation:**
1. Check checkbox/radio labels in options.html
2. Verify button text in popup.html is clear
3. Test that buttons still fit their content
4. Confirm no layout breaks

**Expected impact:** More readable form controls and action buttons.

---

## Phase 2: Color Contrast & Accessibility ✅ COMPLETED

### Task 2.1: Audit Current Contrast Ratios ✅

**Status:** Completed 2026-08-19

**Goal:** Identify all text/background combinations that fail WCAG AA (4.5:1 for normal text, 3:1 for large text).

**Files to review:**
- `themes/default.css`
- `themes/dark.css`
- `themes/light.css`
- `themes/spruce.css`

**Process:**
1. Extract all color token values from each theme
2. Test combinations using WebAIM Contrast Checker or similar tool
3. Document failing combinations in a table

**Output:** Create a list like:
```
Theme: Default
- Issue: --color-text-secondary (#666) on --color-bg (#fff) = 3.5:1 (FAIL)
- Issue: --color-border (#ddd) not applicable to text

Theme: Dark
- Issue: --color-text-primary on --color-bg = needs verification
```

**Validation:**
1. Use browser extension like "WCAG Color Contrast Checker"
2. Test on actual pages (options.html, popup.html)
3. Check with browser accessibility tools

**Expected impact:** Knowledge base for Task 2.2 fixes.

---

### Task 2.2: Fix Contrast Issues ✅

**Status:** Completed 2026-08-19

**Goal:** Adjust color tokens to meet WCAG AA standards.

**Files to modify:**
- Individual theme files based on Task 2.1 findings

**Example changes:**
```css
/* If default.css has issue with secondary text */
/* BEFORE */
--color-text-secondary: #666;

/* AFTER */
--color-text-secondary: #595959; /* Achieves 4.5:1 on white */
```

**Process:**
1. For each failing combination from Task 2.1
2. Adjust the color value minimally to achieve 4.5:1 ratio
3. Use tools like Tanaguru Contrast Finder for suggestions
4. Test the new color in context

**Validation:**
1. Re-run contrast checker on updated colors
2. Visually inspect pages to ensure colors still feel appropriate
3. Test all four themes
4. Verify icons/borders remain visible

**Expected impact:** Full WCAG AA compliance; better readability in all lighting conditions.

---

### Task 2.3: Enhance Focus Indicators ✅

**Status:** Completed 2026-08-19

**Goal:** Make keyboard focus indicators more visible.

**Files to modify:**
- `style.css`

**Changes:**
```css
/* Find focus ring rule (around line 60) */
/* BEFORE */
*:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

/* AFTER */
*:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px rgba(66, 153, 225, 0.2);
}
```

**Rationale:** Thicker outline + subtle glow makes focus unmissable for keyboard users.

**Validation:**
1. Tab through options.html using keyboard only
2. Verify every interactive element has clear focus indicator
3. Check visibility against all background colors
4. Test in all themes

**Expected impact:** Improved keyboard navigation experience; better accessibility.

---

## Phase 3: Code Consolidation ✅ COMPLETED

### Task 3.1: Create Dedicated jQuery UI Override File ✅

**Status:** Completed 2026-08-19

**Goal:** Move all jQuery UI overrides from multiple files into one consolidated location.

**Files to create:**
- `jquery-ui-overrides.css` (new file in root)

**Files to modify (remove jQuery UI rules from):**
- `options.css` (lines 15-100+)
- `buttons.css` (lines 37-63)
- `popup.css` (any jQuery UI rules)
- `themes/dark.css` (lines 27-60)
- `themes/default.css` (similar lines)
- `themes/light.css` (similar lines)
- `themes/spruce.css` (similar lines)

**Process:**
1. Create `jquery-ui-overrides.css`
2. Copy ALL `.ui-*` rules from above files into new file
3. Remove duplicates (keep most specific version)
4. Organize by component: `.ui-button`, `.ui-tabs`, `.ui-dialog`, etc.
5. Delete original `.ui-*` rules from source files
6. Add `<link rel="stylesheet" href="jquery-ui-overrides.css">` to HTML files after jQuery UI link

**Template for new file:**
```css
/**
 * jQuery UI Component Overrides
 * Consolidated from options.css, buttons.css, popup.css, and theme files
 * Last updated: [DATE]
 */

/* ===== Buttons ===== */
.ui-button { /* ... */ }

/* ===== Tabs ===== */
.ui-tabs { /* ... */ }

/* ===== Dialogs ===== */
.ui-dialog { /* ... */ }

/* ===== Slider ===== */
.ui-slider { /* ... */ }

/* ===== State classes ===== */
.ui-state-active { /* ... */ }
.ui-state-hover { /* ... */ }
.ui-state-disabled { /* ... */ }
```

**Validation:**
1. Open options.html and verify all jQuery UI components look identical
2. Test tabs, buttons, sliders, dialogs
3. Switch themes and verify overrides still work
4. Check popup.html for any jQuery UI widgets
5. Run visual regression test if available

**Expected impact:** Single source of truth for jQuery UI styles; easier maintenance; reduced duplication.

---

### Task 3.2: Clean Up Theme Files ✅

**Status:** Completed 2026-08-19

**Goal:** Remove all non-color rules from theme files so they ONLY contain CSS variable overrides.

**Files to modify:**
- `themes/dark.css`
- `themes/default.css`
- `themes/light.css`
- `themes/spruce.css`

**Changes:**
Each theme file should follow this pattern:
```css
/**
 * [Theme Name] Theme
 * Color overrides only - all other styles in base CSS files
 */

:root {
  /* Color tokens */
  --color-bg: #...;
  --color-text-primary: #...;
  --color-text-secondary: #...;
  /* ... all color variables ... */
}

/* NO OTHER RULES SHOULD EXIST */
/* jQuery UI overrides should be in jquery-ui-overrides.css */
/* Component styles should be in components.css, buttons.css, etc. */
```

**Process:**
1. Open each theme file
2. Delete all rules except `:root { ... }`
3. Ensure `:root` block only contains `--color-*` variables
4. Verify no `.ui-*`, `.ivb-*`, or other component rules remain

**Validation:**
1. Switch to each theme in options page
2. Verify colors change correctly
3. Confirm no layout/style breaks
4. Check that removed rules are now handled by jquery-ui-overrides.css

**Expected impact:** Theme files reduced from ~60 lines to ~30 lines; cleaner separation of concerns.

---

## Phase 4: Spacing & Layout Refinements (Low Priority)

### Task 4.1: Add Intermediate Spacing Tokens ✅

**Status:** Completed 2026-08-19

**Goal:** Provide more spacing options between current gap values.

**Files to modify:**
- `style.css`

**Changes:**
```css
/* BEFORE (lines 13-16) */
--gap-xs: 4px;
--gap-sm: 8px;
--gap-md: 12px;
--gap-lg: 20px;

/* AFTER */
--gap-xs: 4px;
--gap-sm: 8px;
--gap-md: 12px;
--gap-base: 16px;  /* NEW */
--gap-lg: 20px;
--gap-xl: 24px;    /* NEW */
--gap-2xl: 32px;   /* NEW */
```

**Rationale:** More granular spacing options reduce need for magic numbers in CSS.

**Validation:**
1. No immediate visual changes (tokens added but not used yet)
2. Verify no CSS errors in console
3. Document new tokens in DESIGN_GUIDELINES.md

**Expected impact:** Better spacing tools for future development.

---

### Task 4.2: Replace Inline Display Styles with Utility Classes

**Goal:** Remove `style="display:none"` from HTML files and use `.hidden` class instead.

**Files to modify:**
- `options.html`
- `popup.html`
- `blocked.html`
- Any other HTML files with inline styles

**Changes:**
```html
<!-- BEFORE -->
<div id="someElement" style="display:none">...</div>

<!-- AFTER -->
<div id="someElement" class="hidden">...</div>
```

**Note:** Verify that JavaScript correctly toggles the `.hidden` class (not just `style.display`).

**Files to check for JS changes:**
- `options.js`
- `popup.js`
- `blocked.js`

**JS pattern:**
```javascript
// BEFORE
element.style.display = 'none';
element.style.display = 'block';

// AFTER
element.classList.add('hidden');
element.classList.remove('hidden');
```

**Validation:**
1. Test show/hide functionality for all toggled elements
2. Verify options page collapsible sections still work
3. Check popup show/hide states
4. Confirm no inline styles remain (search HTML for `style=`)

**Expected impact:** Consistent visibility management; separation of concerns.

---

### Task 4.3: Audit and Optimize options.css Size

**Goal:** Reduce options.css from 474 lines by extracting reusable patterns.

**Files to modify:**
- `options.css` (refactor)
- Possibly `components.css` (add extracted patterns)

**Process:**
1. Identify repeated patterns in options.css
2. Convert to utility classes or component classes
3. Move generic patterns to components.css
4. Update options.html to use new classes
5. Delete redundant rules from options.css

**Common patterns to extract:**
- Checkbox/radio group layouts
- Form field wrappers
- Help text styling
- Section spacing

**Example:**
```css
/* BEFORE: Repeated pattern in options.css */
.blockset-options .field-group { margin-bottom: 12px; }
.time-settings .field-group { margin-bottom: 12px; }
.advanced-options .field-group { margin-bottom: 12px; }

/* AFTER: Utility in components.css */
.field-group { margin-bottom: var(--gap-md); }

/* Use in HTML: */
<div class="field-group">...</div>
```

**Validation:**
1. Options page looks identical before/after
2. options.css reduced by at least 100 lines
3. No new issues introduced
4. Test all block set options still function

**Expected impact:** More maintainable code; reduced CSS size; reusable patterns.

---

## Phase 5: Advanced Improvements (Future)

### Task 5.1: Implement Responsive Typography

**Goal:** Scale font sizes based on viewport width for better mobile experience.

**Files to modify:**
- `style.css`

**Changes:**
```css
/* Add to :root after font-size variables */
@media (max-width: 768px) {
  :root {
    --font-size-base: 16px; /* Keep standard on mobile */
    --font-size-sm: 14px;
  }
}

@media (min-width: 1200px) {
  :root {
    --font-size-base: 18px; /* Larger on big screens */
    --font-size-sm: 16px;
  }
}
```

**Validation:**
1. Test on mobile device or responsive mode
2. Verify readability on small screens
3. Check large desktop displays
4. Ensure no layout breaks at breakpoints

**Expected impact:** Optimized reading experience across all screen sizes.

---

### Task 5.2: Add Dark Mode Contrast Boost Option

**Goal:** Provide a higher contrast version of dark theme for accessibility.

**Files to create:**
- `themes/dark-high-contrast.css`

**Process:**
1. Copy `themes/dark.css`
2. Increase contrast ratios to AAA level (7:1)
3. Use pure white (#fff) for primary text
4. Use deeper backgrounds (#000 or near-black)
5. Add as theme option in settings

**Validation:**
1. Test with contrast checker (all ratios ≥7:1)
2. Verify comfortable to read for extended periods
3. Check all UI elements remain visible
4. Test with actual users who need high contrast

**Expected impact:** Better accessibility for low-vision users.

---

## Testing Checklist

After completing each phase, verify:

- [ ] All four themes (default, dark, light, spruce) display correctly
- [ ] No console errors related to CSS
- [ ] Popup, options, stats, and blocked pages all render properly
- [ ] Keyboard navigation works (Tab, Shift+Tab, Enter, Space)
- [ ] Touch targets meet 44×44px minimum (already implemented)
- [ ] Text remains readable at 200% zoom (browser accessibility feature)
- [ ] No horizontal scrolling on mobile viewports
- [ ] Interactive elements (buttons, checkboxes, tabs) still function
- [ ] Performance: no noticeable slowdown (check DevTools Performance tab)

## Measuring Success

Track these metrics before and after:

1. **Readability score** - Use Flesch Reading Ease or similar
2. **WCAG compliance** - Number of contrast failures (aim: 0)
3. **CSS file sizes** - Total bytes (aim: reduce by 10-15%)
4. **User feedback** - Subjective readability improvement
5. **Accessibility audit** - Use Lighthouse or axe DevTools (aim: 90+ score)

## Notes for Implementation

- **No build step** means all changes apply immediately on browser refresh
- **Test incrementally** after each task, not at end of phase
- **Preserve MPL 2.0 headers** when editing source files
- **Update DESIGN_GUIDELINES.md** when completing a phase
- **Use browser DevTools** for visual debugging (Inspect Element, Computed Styles)
- **Firefox is primary target**, Safari secondary
- **Check `browser.*` API usage** (not `chrome.*`) if modifying JS for utility class toggles

## Future Considerations

Areas not covered in this plan but worth exploring:

- **Animation and transitions** - Smooth state changes (respect `prefers-reduced-motion`)
- **CSS Grid migration** - Replace remaining float/flexbox layouts
- **Component documentation** - Living style guide for all components
- **User customization** - Allow users to override font size in settings
- **RTL language support** - Right-to-left layout for Arabic, Hebrew, etc.
- **Print styles** - Optimized layout for printing options/stats

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Material Design Typography](https://material.io/design/typography/)
- [Type Scale Generator](https://typescale.com/)
- [CSS Custom Properties Guide](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

**Document version:** 1.1  
**Created:** 2026-08-19  
**For questions or issues implementing these optimizations, refer to DESIGN_GUIDELINES.md or project documentation.**
