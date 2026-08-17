# ivBlock Design Guidelines (CSS / HTML)

This document captures the current front-end structure and recommended design guidelines for future redesign work. It is produced from an audit of the project's CSS and HTML files (style.css, options.css, popup.css, controls.css, buttons.css, themes/*, fonts.css, jquery-ui overrides, and the various HTML pages).

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

- Centralized design tokens (CSS variables) make theming straightforward.
- Clear, consistent component classes (buttons, input styles) across pages.
- Themes are isolated to separate files; runtime switching via `themeLink` is straightforward.
- Accessibility-aware elements: focus ring token and `input:focus` box-shadow.
- Use of picture/source for logos allows dark-mode-specific images.

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

1. Add breakpoint and z-index tokens to `style.css`.
2. Replace global `div { margin-top: 40px }` with a `.page-section` or `.spaced` utility and update affected pages (`blocked`, overlay, etc.).
3. Consolidate jQuery UI overrides into one central file and remove duplicates from theme files.
4. Audit theme files to keep only variable overrides.
5. Introduce `.hidden` utility and replace inline `display:none` usages.

## Where this lives and how to use

- Tokens: `style.css`
- Themes: `themes/*.css` (override variables only)
- jQuery UI overrides: move to `jquery-ui-custom.css` or `jqui-overrides.css`
- Component styles: `buttons.css`, `controls.css`, `popup.css`, `options.css`
- Switch theme at runtime by changing `#themeLink` href (already implemented).

---

If this looks good, next step: implement the high-priority changes (add tokens, remove broad `div` rule, and consolidate jQuery UI overrides). Indicate which change to start with or allow proceeding in the recommended order.