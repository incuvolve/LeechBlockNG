# ivBlock Design Guidelines (CSS / HTML)

This document captures the current front-end structure and recommended design guidelines for future redesign work. It is produced from an audit of the project's CSS and HTML files (style.css, options.css, popup.css, controls.css, buttons.css, themes/*, fonts.css, jquery-ui overrides, and the various HTML pages).

**Last updated:** 2026-08-19  
**Related documents:**  
- [UI_OPTIMIZATION.md](.github/UI_OPTIMIZATION.md) - Step-by-step UI improvement roadmap

---

## Current setup — summary

- Central design tokens live in style.css (CSS custom properties): colors, typography, spacing (--gap-*, --font-*, --control-*, --shadow-*, --transition).
- The app supports multiple themes implemented as separate CSS files in `themes/` (default, dark, light, spruce). Themes override color variables.
- Fonts are managed in `fonts.css` using @font-face for Open Sans and fallback monospace.
- UI uses jQuery UI in some pages; several files provide jQuery UI customizations (`jquery-ui-custom.css`) and small overrides across `options.css` and theme files.
- Reusable component classes: `.ivblock-button`, `.limited-width`, `.input-narrow`, `.inline-control-row`, `.stats-card`, etc.
- Broad base rules exist in `style.css` (e.g., `div { margin-top: 40px; }`) which are explicitly neutralized in some feature files (options.css, popup.css) to avoid unwanted spacing.
- Pages load a `themeLink` stylesheet element (id="themeLink") and sometimes inline `<style id="customStyle">` to allow runtime theme injection/custom CSS.
- Overlay/content styles (content.js) use very large z-index and fixed positioning; alert UI uses inlined data URIs for icons.
- Responsive behaviour: breakpoints at 600px and additional ranges (601–768, >=769) with explicit adjustments for tap targets and dialog widths.

## Strengths

- **Design system foundation**: Centralized design tokens (CSS variables) in `style.css` make theming and updates straightforward.
- **Component architecture**: Clear, consistent component classes (`.ivblock-button`, `.ivb-card`, etc.) reused across pages.
- **Theme system**: Isolated theme files (`themes/*.css`) with runtime switching via `#themeLink` element.
- **Accessibility baseline**: Focus ring tokens, keyboard focus states, and semantic HTML structure.
- **Responsive images**: `picture`/`source` elements provide dark-mode-specific logos.
- **Modern layout**: CSS Grid and Flexbox used throughout for responsive layouts.
- **Typography system**: Open Sans web font with proper weight variants (300, 400, 400i).
- **Touch-friendly controls**: `--control-height: 44px` ensures adequate tap targets.

## Issues & pain points (observed)

- Global element rules (e.g., `div { margin-top: 40px; }`) are brittle and force many overrides; this increases cognitive load when changing layout.
- Some styling is duplicated across theme files (repeating jQuery UI state rules) rather than limited to variables or component overrides.
- Presence of inline styles and style attributes in HTML (e.g., `style="display: none;"`) and inline `<style id="customStyle">` can make audits harder.
- jQuery UI usage forces additional overrides; these live in multiple files instead of a single compatibility layer.
- No documented naming convention for classes; a few un-prefixed generic classes (e.g., `.logo`, `.div`) risk collisions if new code adds global rules.
- Breakpoint values are hard-coded in several places; there are no variables for breakpoints in CSS tokens.

## Design rules and guidelines (recommended)

1. Central tokens remain the single source of truth
   - Keep and extend the existing tokens in `style.css` (colors, typography, spacing, radii, shadows, transitions, control sizes).
   - Add tokens for breakpoints (e.g., `--bp-xs`, `--bp-sm`, `--bp-md`, `--bp-lg`) and z-index layers (e.g., `--z-overlay`, `--z-dialog`, `--z-content`) to avoid magic numbers.

2. Stop using broad element overrides
   - Remove or limit `div { margin-top: 40px }`. Replace with explicit layout utility classes (e.g., `.page-section`, `.spaced`) and use those where needed.
   - Prefer composable utility classes and component containers rather than global changes.

3. Namespacing and class conventions
   - Prefix component classes with a consistent namespace, e.g. `.ivb-` or `.ivblock-` (existing `.ivblock-button` is good) to avoid collisions.
   - Use BEM or a similarly simple convention for complex components (`.ivb-card`, `.ivb-card__header`).

4. Themes and variables
   - Keep theme files limited to variable overrides only (colors and any exceptional values). Avoid repeating component rules in every theme file.
   - Where component state depends on color, read from variables (e.g., `background: var(--color-secondary-bg)`), not hard-coded hex in theme files.

5. Consolidate jQuery UI compatibility
   - Move all jQuery UI overrides into a single file (e.g., `jqui-overrides.css`) that is loaded where necessary. This centralises tweaks and reduces duplication.

6. Accessibility and contrast
   - Verify color contrast for all interactive states against WCAG AA for text and UI elements.
   - Ensure focus styles are visible and not removed; prefer an accessible and visible outline or box-shadow using `--color-focus-ring`.
   - Maintain target sizes for mobile (min 44px tap target) — use tokens (`--control-height`) to enforce.

7. Responsive system
   - Introduce breakpoint tokens and refactor media queries to reference those breakpoints so changes are predictable.
   - Use CSS Grid/Flex utilities and container width tokens (e.g., `--content-max-width`) instead of per-page magic numbers.

8. Utilities and component library
   - Define a small set of utility classes (spacing, flex helpers, text alignment) and a component library (buttons, inputs, cards, dialogs) documented in this repo.
   - Reuse `.limited-width`, `.inline-control-row` patterns and document their purpose.

9. Avoid inline styles for layout and visibility
   - Replace `style="display:none"` with utility classes like `.hidden`/`.is-hidden` toggled by scripts to keep styling in CSS.
   - Keep `<style id="customStyle">` for truly dynamic, per-instance critical CSS only; prefer changing variables on `:root` or the `themeLink` content.

10. Assets and images
   - Keep logos and images responsive using `max-width:100%` and preserve `picture` usage for dark-mode variants.
   - Move data-URI large assets into static files if they are reused across pages.

11. Documentation and tests
   - Add visual regression steps for key pages (popup, blocked, options). Document where to run them and which components to check.
   - Add a short README section explaining theme switching (via `#themeLink`) and where tokens live.

## Implementation priorities (first pass)

✅ **Completed:**
1. ✅ Added breakpoint and z-index tokens to `style.css`
2. ✅ Replaced global `div { margin-top: 40px }` with `.page-section` and `.spaced` utilities
3. ✅ Introduced `.hidden` utility for visibility control

**Pending:**
4. ✅ **Typography improvements complete** - Font sizes increased, line-height improved (see Phase 1)
5. ✅ **Color contrast fixes complete** - All themes now WCAG AA compliant (see Phase 2)
6. ✅ **Focus indicators enhanced** - Better keyboard navigation visibility (see Phase 2)
7. Consolidate jQuery UI overrides into one central file (`jquery-ui-overrides.css`)
8. Audit theme files to keep only variable overrides (remove duplicate jQuery UI state rules)
9. Standardize spacing scale with additional tokens

## Current file structure

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `style.css` | Design tokens, base styles, utilities | 247 | ✅ Modernized |
| `components.css` | Buttons, cards, dialogs, typography | 251 | ✅ Component library |
| `buttons.css` | Button variants and states | 109 | ✅ Token-based |
| `controls.css` | Form control utilities | 20 | ✅ Minimal |
| `fonts.css` | Open Sans @font-face declarations | 47 | ✅ Complete |
| `options.css` | Options page specific styles | 474 | ⚠️ Needs consolidation |
| `popup.css` | Toolbar popup specific styles | 58 | ✅ Clean |
| `stats.css` | Statistics page styles | 15 | ✅ Minimal |
| `lockdown.css` | Lockdown page styles | 23 | ✅ Minimal |
| `override.css` | Override page styles | 44 | ✅ Minimal |
| `content.css` | Content script overlay styles | 81 | ✅ High z-index isolation |
| `themes/*.css` | Theme color overrides | ~60 each | ⚠️ Contains duplicate rules |

## Where this lives and how to use

- **Design tokens**: `style.css` (`:root` CSS custom properties)
- **Themes**: `themes/*.css` (should contain *only* variable overrides)
- **jQuery UI overrides**: Currently scattered; should consolidate to `jquery-ui-overrides.css`
- **Component library**: `components.css` (modern components), `buttons.css`, `controls.css`
- **Page-specific**: `options.css`, `popup.css`, `stats.css`, etc.
- **Theme switching**: Runtime via `document.getElementById('themeLink').href = 'themes/dark.css'`

## Next steps

For detailed, step-by-step UI improvements ready for implementation by AI assistants, see **[UI_OPTIMIZATION.md](.github/UI_OPTIMIZATION.md)**.
