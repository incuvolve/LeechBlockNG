# UI Testing Checklist — ivBlock

This file lists steps and files to check when testing the UI changes (icons, components, accessibility, themes).

Pages to open (unpacked extension or open file in browser):
- popup.html — toolbar popup, verify icons on primary buttons and spacing
- options.html — Block Set toolbar, dialog behaviour, left-aligned dialog content
- override.html — minutes input, Activate Override button icon, dark-mode contrast
- lockdown.html — minutes/hours inputs, Activate Lockdown icon
- add-sites.html — Add Sites button icon
- stats.html — Restart / Restart All icons
- blocked.html / delayed.html / password.html — logo, warning message, overlay appearance
- diagnostics.html — Test button icon and results textarea

What to verify
- Icons: appear and align with button text; no broken <use> references
- Buttons: primary/secondary variants, hover and active micro-interactions
- Dialogs: left-aligned content and themed buttons, focus-visible ring on keyboard tab
- Inputs: minutes input fits up to 4 digits, .ivb-input focus styles
- Dark mode: contrast for buttons and dialog buttons; borders visible on Safari
- Accessibility: keyboard navigation (tab order), visible focus states, WCAG contrast

Files changed (high level)
- Added: components.css, images/icons.svg (backup), .github/UI_TESTING.md
- Edited: style.css, buttons.css, options.css, override.css, components.css (updates), multiple HTML files (popup.html, options.html, override.html, add-sites.html, lockdown.html, stats.html, diagnostics.html, blocked.html, delayed.html, password.html)

How to run
- Load this folder as an unpacked extension in the target browser (e.g. Safari/Firefox/Chrome) or open pages directly for quick checks.
- Verify console for CSP or svg errors if icons don't appear.

Notes
- Inline SVG sprite was added to pages to ensure icons render in extension contexts (CSP may still block external resources).
- If icons still do not appear in Safari, inspect console or try inline sprite in the specific page.

Created by Copilot CLI.
