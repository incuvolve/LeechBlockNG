/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * CSS Checkbox Functionality Tests
 * 
 * These tests verify that checkboxes remain functional and are not broken
 * by CSS rules that remove their native appearance or block pointer events.
 * 
 * Regression test for: checkboxes made non-functional by appearance: none
 */

const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('CSS Checkbox Functionality', () => {
	let dom;
	let document;
	let window;

	beforeEach(() => {
		// Create a fresh DOM for each test
		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<link href="/fonts.css" rel="stylesheet">
				<link href="/jquery-ui/jquery-ui.min.css" rel="stylesheet">
				<link href="/jquery-ui/jquery-ui-custom.css" rel="stylesheet">
				<link href="/style.css" rel="stylesheet">
				<link href="/components.css" rel="stylesheet">
				<link href="/jquery-ui-overrides.css" rel="stylesheet">
				<link href="/options.css" rel="stylesheet">
				<link href="/buttons.css" rel="stylesheet">
				<link href="/controls.css" rel="stylesheet">
				<style id="test-styles">
					/* Load actual CSS content for testing */
				</style>
			</head>
			<body>
				<div id="tabs" class="ui-widget">
					<div class="ui-tabs-panel">
						<fieldset>
							<legend>Test Block Set</legend>
							<p>
								<input id="sortSites1" type="checkbox">
								<label for="sortSites1">Sort the list of sites</label>
							</p>
							<p>
								<input id="rollover1" type="checkbox">
								<label for="rollover1">Roll over unused time</label>
							</p>
							<div id="days1">
								<span class="nowrap-item">
									<input id="day01" type="checkbox">
									<label for="day01">Sunday</label>
								</span>
								<span class="nowrap-item">
									<input id="day11" type="checkbox">
									<label for="day11">Monday</label>
								</span>
							</div>
							<p>
								<input id="applyFilter1" type="checkbox">
								<label for="applyFilter1">Apply filter</label>
							</p>
						</fieldset>
						<fieldset>
							<legend>Another Block Set</legend>
							<p>
								<input id="sortSites2" type="checkbox">
								<label for="sortSites2">Sort the list of sites</label>
							</p>
						</fieldset>
					</div>
				</div>
			</body>
			</html>
		`;

		dom = new JSDOM(html);
		document = dom.window.document;
		window = dom.window;

		// Load the actual CSS content
		const cssFiles = [
			'../components.css',
			'../jquery-ui-overrides.css',
			'../options.css',
		];

		let combinedCss = '';
		cssFiles.forEach(file => {
			const cssPath = path.resolve(__dirname, file);
			if (fs.existsSync(cssPath)) {
				combinedCss += fs.readFileSync(cssPath, 'utf8') + '\n';
			}
		});

		document.getElementById('test-styles').textContent = combinedCss;
	});

	describe('CSS Rules Do Not Break Checkboxes', () => {
		it('should not apply appearance: none to checkboxes', () => {
			const jqueryUiOverridesPath = path.resolve(__dirname, '../jquery-ui-overrides.css');
			const cssContent = fs.readFileSync(jqueryUiOverridesPath, 'utf8');

			// Check that the Safari input styling rule excludes checkboxes
			const safariInputRule = cssContent.match(/\.ui-widget input[^{]*\{[^}]*-webkit-appearance: none/);
			
			if (safariInputRule) {
				const fullRule = safariInputRule[0];
				// Verify that the selector excludes checkboxes
				expect(fullRule).toMatch(/:not\(\[type="checkbox"\]\)/);
				expect(fullRule).toMatch(/:not\(\[type="radio"\]\)/);
			}
		});

		it('should have pointer-events: auto on inputs', () => {
			const jqueryUiOverridesPath = path.resolve(__dirname, '../jquery-ui-overrides.css');
			const cssContent = fs.readFileSync(jqueryUiOverridesPath, 'utf8');

			// Verify that inputs have pointer-events: auto
			expect(cssContent).toMatch(/input[^{]*\{[^}]*pointer-events:\s*auto\s*!important/);
		});

		it('should have pointer-events: auto on fieldsets', () => {
			const componentsPath = path.resolve(__dirname, '../components.css');
			const cssContent = fs.readFileSync(componentsPath, 'utf8');

			// Verify that fieldsets have pointer-events: auto
			expect(cssContent).toMatch(/fieldset[^{]*\{[^}]*pointer-events:\s*auto\s*!important/);
		});
	});

	describe('Checkbox DOM Functionality', () => {
		it('should allow checking checkboxes programmatically', () => {
			const checkbox = document.getElementById('sortSites1');
			
			expect(checkbox.checked).toBe(false);
			
			checkbox.checked = true;
			expect(checkbox.checked).toBe(true);
			
			checkbox.checked = false;
			expect(checkbox.checked).toBe(false);
		});

		it('should allow checking checkboxes via click events', () => {
			const checkbox = document.getElementById('rollover1');
			
			expect(checkbox.checked).toBe(false);
			
			checkbox.click();
			expect(checkbox.checked).toBe(true);
			
			checkbox.click();
			expect(checkbox.checked).toBe(false);
		});

		it('should allow checking checkboxes inside .ui-widget containers', () => {
			const checkbox = document.getElementById('day01');
			const uiWidget = document.getElementById('tabs');
			
			// Verify checkbox is inside .ui-widget
			expect(uiWidget.classList.contains('ui-widget')).toBe(true);
			expect(uiWidget.contains(checkbox)).toBe(true);
			
			// Verify checkbox can be toggled
			expect(checkbox.checked).toBe(false);
			checkbox.checked = true;
			expect(checkbox.checked).toBe(true);
		});

		it('should allow checking checkboxes inside fieldsets', () => {
			const checkbox = document.getElementById('applyFilter1');
			const fieldset = checkbox.closest('fieldset');
			
			expect(fieldset).not.toBeNull();
			expect(fieldset.tagName.toLowerCase()).toBe('fieldset');
			
			// Verify checkbox can be toggled
			expect(checkbox.checked).toBe(false);
			checkbox.checked = true;
			expect(checkbox.checked).toBe(true);
		});

		it('should allow checking all checkboxes in the options page structure', () => {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]');
			
			expect(checkboxes.length).toBeGreaterThan(0);
			
			checkboxes.forEach(checkbox => {
				expect(checkbox.checked).toBe(false);
				checkbox.checked = true;
				expect(checkbox.checked).toBe(true);
			});
		});

		it('should allow unchecking all checkboxes', () => {
			const checkboxes = document.querySelectorAll('input[type="checkbox"]');
			
			// First check all
			checkboxes.forEach(checkbox => {
				checkbox.checked = true;
			});
			
			// Then uncheck all
			checkboxes.forEach(checkbox => {
				checkbox.checked = false;
				expect(checkbox.checked).toBe(false);
			});
		});
	});

	describe('Checkbox Label Association', () => {
		it('should have properly associated labels', () => {
			const checkbox = document.getElementById('sortSites1');
			const label = document.querySelector('label[for="sortSites1"]');
			
			expect(label).not.toBeNull();
			expect(label.getAttribute('for')).toBe('sortSites1');
		});

		it('should toggle checkbox when label is clicked', () => {
			const checkbox = document.getElementById('day11');
			const label = document.querySelector('label[for="day11"]');
			
			expect(checkbox.checked).toBe(false);
			
			// Simulate label click
			label.click();
			expect(checkbox.checked).toBe(true);
			
			label.click();
			expect(checkbox.checked).toBe(false);
		});

		it('should work with checkboxes inside .nowrap-item spans', () => {
			const checkbox = document.getElementById('day01');
			const span = checkbox.closest('.nowrap-item');
			
			expect(span).not.toBeNull();
			expect(span.classList.contains('nowrap-item')).toBe(true);
			
			// Verify checkbox can still be toggled
			checkbox.click();
			expect(checkbox.checked).toBe(true);
		});
	});

	describe('Multiple Checkboxes in Same Container', () => {
		it('should allow independent toggling of multiple checkboxes', () => {
			const checkbox1 = document.getElementById('sortSites1');
			const checkbox2 = document.getElementById('rollover1');
			const checkbox3 = document.getElementById('applyFilter1');
			
			checkbox1.checked = true;
			expect(checkbox1.checked).toBe(true);
			expect(checkbox2.checked).toBe(false);
			expect(checkbox3.checked).toBe(false);
			
			checkbox2.checked = true;
			expect(checkbox1.checked).toBe(true);
			expect(checkbox2.checked).toBe(true);
			expect(checkbox3.checked).toBe(false);
			
			checkbox1.checked = false;
			expect(checkbox1.checked).toBe(false);
			expect(checkbox2.checked).toBe(true);
			expect(checkbox3.checked).toBe(false);
		});

		it('should handle day checkboxes independently', () => {
			const sunday = document.getElementById('day01');
			const monday = document.getElementById('day11');
			
			sunday.checked = true;
			expect(sunday.checked).toBe(true);
			expect(monday.checked).toBe(false);
			
			monday.checked = true;
			expect(sunday.checked).toBe(true);
			expect(monday.checked).toBe(true);
		});
	});

	describe('Regression Prevention', () => {
		it('should not have appearance: none on any checkbox selectors', () => {
			const cssFiles = [
				'../components.css',
				'../jquery-ui-overrides.css',
				'../options.css',
				'../style.css',
			];

			cssFiles.forEach(file => {
				const cssPath = path.resolve(__dirname, file);
				if (fs.existsSync(cssPath)) {
					const cssContent = fs.readFileSync(cssPath, 'utf8');
					
					// Look for patterns that would break checkboxes
					const problematicPatterns = [
						// Direct checkbox appearance removal
						/input\[type="checkbox"\][^{]*\{[^}]*appearance:\s*none/,
						/input\[type="checkbox"\][^{]*\{[^}]*-webkit-appearance:\s*none/,
						// .ui-widget input without :not() exclusions
						/\.ui-widget\s+input\s*\{[^}]*appearance:\s*none/,
					];

					problematicPatterns.forEach((pattern, index) => {
						const match = cssContent.match(pattern);
						if (match && !match[0].includes(':not([type="checkbox"])')) {
							fail(`Found problematic CSS pattern in ${file}: ${match[0]}`);
						}
					});
				}
			});
		});

		it('should not have pointer-events: none on fieldsets', () => {
			const componentsPath = path.resolve(__dirname, '../components.css');
			const cssContent = fs.readFileSync(componentsPath, 'utf8');

			// Check that fieldsets don't have pointer-events: none
			const fieldsetRule = cssContent.match(/fieldset[^{]*\{[^}]*pointer-events:\s*none/);
			expect(fieldsetRule).toBeNull();
		});

		it('should not have opacity: 0 on fieldsets or checkboxes', () => {
			const cssFiles = [
				'../components.css',
				'../jquery-ui-overrides.css',
				'../options.css',
			];

			cssFiles.forEach(file => {
				const cssPath = path.resolve(__dirname, file);
				if (fs.existsSync(cssPath)) {
					const cssContent = fs.readFileSync(cssPath, 'utf8');
					
					// Check for opacity: 0 on fieldsets or checkboxes
					const problematicOpacity = cssContent.match(/(?:fieldset|input\[type="checkbox"\])[^{]*\{[^}]*opacity:\s*0(?:\s|;|\})/);
					expect(problematicOpacity).toBeNull();
				}
			});
		});
	});
});
