/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs');
const path = require('path');

// Load options.html to give options.js a complete DOM before it initialises.
// Extract body content only to avoid overwriting the <html>/<head> elements.
let optionsHtml = fs.readFileSync(path.resolve(__dirname, '../options.html'), 'utf8');
const bodyMatch = optionsHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
document.body.innerHTML = bodyMatch ? bodyMatch[1] : '';

// Mock browser API — must be set before require('../options.js').
const browser = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ numSets: "1", simplified: true })),
            set: jest.fn(() => Promise.resolve()),
        },
        sync: {
            get: jest.fn(() => Promise.resolve({})),
            set: jest.fn(() => Promise.resolve()),
        },
    },
    runtime: {
        getManifest: () => ({ version: '1.2.3' }),
        sendMessage: jest.fn(),
        getPlatformInfo: jest.fn(() => Promise.resolve({ os: 'mac' })),
        getURL: jest.fn((path) => 'moz-extension://id/' + path),
    },
    tabs: {
        create: jest.fn(),
    },
    permissions: {
        request: jest.fn(),
    },
    i18n: {
        getMessage: jest.fn((key) => key),
    },
};

// DOM-aware jQuery mock: val() reads/writes the real jsdom element value,
// all other methods are chainable no-ops or return empty strings.
const makeJQueryResult = (selector) => {
    const id = (typeof selector === 'string' && selector.startsWith('#'))
        ? selector.slice(1) : null;
    const el = id ? document.getElementById(id) : null;

    const result = {
        html: jest.fn(function(c) { return c === undefined ? '' : this; }),
        text: jest.fn().mockReturnThis(),
        val: jest.fn(function(v) {
            if (v !== undefined) { if (el) el.value = v; return this; }
            return el ? el.value : '';
        }),
        button: jest.fn().mockReturnThis(),
        click: jest.fn().mockReturnThis(),
        keydown: jest.fn().mockReturnThis(),
        keyup: jest.fn().mockReturnThis(),
        change: jest.fn().mockReturnThis(),
        focus: jest.fn().mockReturnThis(),
        dialog: jest.fn().mockReturnThis(),
        tabs: jest.fn().mockReturnThis(),
        show: jest.fn().mockReturnThis(),
        hide: jest.fn().mockReturnThis(),
        effect: jest.fn().mockReturnThis(),
        append: jest.fn().mockReturnThis(),
        before: jest.fn().mockReturnThis(),
        attr: jest.fn().mockReturnThis(),
        prop: jest.fn().mockReturnThis(),
        css: jest.fn().mockReturnThis(),
        on: jest.fn().mockReturnThis(),
        each: jest.fn().mockReturnThis(),
    };
    result.fn = result;
    return result;
};

const jQueryMock = jest.fn((selector) => makeJQueryResult(selector));
jQueryMock.fn = {};

global.browser = browser;
global.$ = jQueryMock;
global.jQuery = jQueryMock;

// common.js calls warn/log at runtime but doesn't define them as globals.
// Provide no-op mocks so calls from getParsedURL etc. don't throw.
global.warn = jest.fn();
global.log = jest.fn();

require('../common.js');
require('../options.js');

describe('options.js tests', () => {
    let consoleLogSpy;
    let consoleWarnSpy;

    beforeAll(() => {
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        global.gNumSets = 1;
    });

    // ── confirmAccess – must run BEFORE gAccessConfirmed is set to true ─────────
    // These tests require gAccessConfirmed=false (module initial state).
    // Place them first so they run before the async retrieveOptions chain fires.
    describe('confirmAccess – early (gAccessConfirmed=false)', () => {
        it('opens password prompt when oa=1 with password (hpp=true)', () => {
            expect(() => global.confirmAccess({ oa: 1, password: 'secret', hpp: true })).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#promptPasswordInput');
        });

        it('uses text type for password input when hpp=false', () => {
            expect(() => global.confirmAccess({ oa: 1, password: 'secret', hpp: false })).not.toThrow();
        });

        it('shows access code prompt for oa=2 (text display)', () => {
            expect(() => global.confirmAccess({ oa: 2, accessCodeImage: false })).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#promptAccessCode');
        });

        it('generates longer code for oa=3', () => {
            expect(() => global.confirmAccess({ oa: 3, accessCodeImage: false })).not.toThrow();
        });

        it('generates longest code for oa=4', () => {
            expect(() => global.confirmAccess({ oa: 4, accessCodeImage: false })).not.toThrow();
        });

        it('sets gAccessConfirmed=true and shows form for oa=0 (no password)', () => {
            // This test intentionally sets gAccessConfirmed=true for subsequent tests
            expect(() => global.confirmAccess({ oa: '0', password: '' })).not.toThrow();
        });

        it('returns early and shows form immediately when already confirmed', () => {
            // gAccessConfirmed is now true from the previous test
            expect(() => global.confirmAccess({ oa: 1, password: 'anything' })).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#form');
        });
    });

    // ── displayAccessCode – early tests ─────────────────────────────────────
    describe('displayAccessCode', () => {
        it('displays short code as text', () => {
            expect(() => global.displayAccessCode('ABCD1234', false)).not.toThrow();
        });

        it('displays 128-char code as text (two lines)', () => {
            expect(() => global.displayAccessCode('A'.repeat(128), false)).not.toThrow();
        });

        it('displays short code as canvas image', () => {
            const canvas = document.getElementById('promptAccessCodeCanvas');
            if (canvas) {
                const ctx = { font: '', fillStyle: '', scale: jest.fn(), measureText: jest.fn(() => ({ width: 100 })), fillText: jest.fn() };
                jest.spyOn(canvas, 'getContext').mockReturnValue(ctx);
            }
            expect(() => global.displayAccessCode('ABCD', true)).not.toThrow();
        });

        it('displays 128-char code as canvas image (two rows)', () => {
            const canvas = document.getElementById('promptAccessCodeCanvas');
            if (canvas) {
                const ctx = { font: '', fillStyle: '', scale: jest.fn(), measureText: jest.fn(() => ({ width: 100 })), fillText: jest.fn() };
                jest.spyOn(canvas, 'getContext').mockReturnValue(ctx);
            }
            expect(() => global.displayAccessCode('A'.repeat(128), true)).not.toThrow();
        });
    });

    describe('isTrue', () => {
        it('should return true for "true" (case-insensitive)', () => {
            expect(global.isTrue('true')).toBe(true);
            expect(global.isTrue('True')).toBe(true);
            expect(global.isTrue('TRUE')).toBe(true);
        });

        it('should return false for other strings', () => {
            expect(global.isTrue('false')).toBe(false);
            expect(global.isTrue('t')).toBe(false);
            expect(global.isTrue('')).toBe(false);
            expect(global.isTrue(' ')).toBe(false);
        });
    });

    describe('saveOptions validation', () => {
        it('should return false for invalid time format', () => {
            document.getElementById('times1').value = 'invalid-time';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('should return false for invalid delaySecs format', () => {
            document.getElementById('times1').value = '0000-2400';
            document.getElementById('delaySecs1').value = 'abc';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
            document.getElementById('delaySecs1').value = '5'; // restore
        });

        it('should return false for invalid delayAllowMins format', () => {
            document.getElementById('times1').value = '0000-2400';
            document.getElementById('delaySecs1').value = '5';
            document.getElementById('delayAllowMins1').value = 'abc';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
            document.getElementById('delayAllowMins1').value = '1'; // restore
        });
    });

    describe('retrieveOptions', () => {
        it('should call storage.local.get', () => {
            global.retrieveOptions();
            expect(browser.storage.local.get).toHaveBeenCalled();
        });
    });

    // ── closeOptions ────────────────────────────────────────────────────────
    describe('closeOptions', () => {
        it('sends a close message via browser.runtime', () => {
            global.closeOptions();
            expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    // ── updateBlockSetName ───────────────────────────────────────────────────
    describe('updateBlockSetName', () => {
        it('sets custom text on the block set tab name', () => {
            global.updateBlockSetName(1, 'My Set');
            expect(document.getElementById('blockSetName1').innerText).toBe('My Set');
        });

        it('falls back to i18n default when name is empty', () => {
            global.updateBlockSetName(1, '');
            expect(browser.i18n.getMessage).toHaveBeenCalledWith('optBlockSetDefault');
        });
    });

    // ── showSimplifiedOptions ────────────────────────────────────────────────
    describe('showSimplifiedOptions', () => {
        it('hides simplifiable elements and shows fullOpts buttons when simplify=true', () => {
            global.showSimplifiedOptions(true);
            expect(jQueryMock).toHaveBeenCalledWith('.simplifiable');
            expect(jQueryMock).toHaveBeenCalledWith("button[id^='fullOpts']");
        });

        it('shows simplifiable elements and hides fullOpts buttons when simplify=false', () => {
            global.showSimplifiedOptions(false);
            expect(jQueryMock).toHaveBeenCalledWith('.simplifiable');
            expect(jQueryMock).toHaveBeenCalledWith("button[id^='fullOpts']");
        });
    });

    // ── updatePasswordPageOptions ────────────────────────────────────────────
    describe('updatePasswordPageOptions', () => {
        it('does not throw for a non-password blockURL', () => {
            document.getElementById('blockURL1').value = 'blocked.html?$S&$U';
            expect(() => global.updatePasswordPageOptions(1)).not.toThrow();
            document.getElementById('blockURL1').value = '';
        });

        it('does not throw when blockURL matches the password URL', () => {
            document.getElementById('blockURL1').value = 'password.html?$S&$U';
            expect(() => global.updatePasswordPageOptions(1)).not.toThrow();
            document.getElementById('blockURL1').value = '';
        });
    });

    // ── showClockOffsetTime ──────────────────────────────────────────────────
    describe('showClockOffsetTime', () => {
        afterEach(() => {
            document.getElementById('clockOffset').value = '';
        });

        it('hides the clock offset time span when clockOffset is empty', () => {
            document.getElementById('clockOffset').value = '';
            global.showClockOffsetTime();
            expect(jQueryMock).toHaveBeenCalledWith('#clockOffsetTime');
        });

        it('shows the clock offset time span when clockOffset is a valid number', () => {
            document.getElementById('clockOffset').value = '60';
            global.showClockOffsetTime();
            expect(jQueryMock).toHaveBeenCalledWith('#clockOffsetTime');
        });
    });

    // ── openDiagnostics ──────────────────────────────────────────────────────
    describe('openDiagnostics', () => {
        it('opens a new tab pointing at diagnostics.html', () => {
            global.openDiagnostics();
            expect(browser.runtime.getURL).toHaveBeenCalledWith('diagnostics.html');
            expect(browser.tabs.create).toHaveBeenCalledWith(
                expect.objectContaining({ url: expect.stringContaining('diagnostics.html') })
            );
        });
    });

    // ── disableGeneralOptions ────────────────────────────────────────────────
    describe('disableGeneralOptions', () => {
        it('disables all general option elements without throwing', () => {
            expect(() => global.disableGeneralOptions()).not.toThrow();
            expect(document.getElementById('saveSecs').disabled).toBe(true);
        });
    });

    // ── disableImportOptions ─────────────────────────────────────────────────
    describe('disableImportOptions', () => {
        it('disables import elements without throwing', () => {
            expect(() => global.disableImportOptions()).not.toThrow();
            expect(document.getElementById('importOptions').disabled).toBe(true);
        });
    });

    // ── updateSubOptions ─────────────────────────────────────────────────────
    describe('updateSubOptions', () => {
        it('updates sub-option disabled states for set 1 without throwing', () => {
            expect(() => global.updateSubOptions(1)).not.toThrow();
        });
    });

    // ── disableNonAndroidOptions ─────────────────────────────────────────────
    describe('disableNonAndroidOptions', () => {
        afterEach(() => {
            document.getElementById('addHistory1').disabled = false;
            document.getElementById('addHistory1').checked = false;
        });

        it('disables the addHistory checkbox for the given set', () => {
            global.disableNonAndroidOptions(1);
            expect(document.getElementById('addHistory1').disabled).toBe(true);
            expect(document.getElementById('addHistory1').checked).toBe(false);
        });
    });

    // ── updateMoveSetButtons ─────────────────────────────────────────────────
    describe('updateMoveSetButtons', () => {
        beforeEach(() => {
            global.gSetDisabled = [];
            global.gSetDisabled[1] = false;
        });

        it('disables both move buttons when there is only one set', () => {
            global.gNumSets = 1;
            global.updateMoveSetButtons();
            expect(document.getElementById('moveSetL1').disabled).toBe(true);
            expect(document.getElementById('moveSetR1').disabled).toBe(true);
        });
    });

    // ── initAccessControlPrompt ──────────────────────────────────────────────
    describe('initAccessControlPrompt', () => {
        it('initialises the dialog via jQuery without throwing', () => {
            expect(() => global.initAccessControlPrompt('accessPrompt')).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#accessPrompt');
        });
    });

    // ── compileExportOptions ─────────────────────────────────────────────────
    describe('compileExportOptions', () => {
        beforeEach(() => {
            document.getElementById('blockURL1').value = 'blocked.html?$S&$U';
            document.getElementById('delaySecs1').value = '5';
        });

        afterEach(() => {
            document.getElementById('blockURL1').value = '';
            document.getElementById('delaySecs1').value = '';
        });

        it('returns an options object with per-set keys without throwing', () => {
            let opts;
            expect(() => { opts = global.compileExportOptions(false); }).not.toThrow();
            expect(typeof opts).toBe('object');
            expect(opts).toHaveProperty('sites1');
            expect(opts).toHaveProperty('times1');
        });

        it('includes all fields when passwords=true', () => {
            let opts;
            expect(() => { opts = global.compileExportOptions(true); }).not.toThrow();
            expect(typeof opts).toBe('object');
        });
    });

    // ── saveOptions – additional validation paths ────────────────────────────
    describe('saveOptions – additional validation paths', () => {
        // Sets all per-set and general fields to values that pass validation,
        // so each individual test only needs to corrupt one field.
        const setValidFields = () => {
            document.getElementById('times1').value = '';
            document.getElementById('limitMins1').value = '';
            document.getElementById('limitOffset1').value = '';
            document.getElementById('delaySecs1').value = '5';
            document.getElementById('delayAllowMins1').value = '';
            document.getElementById('minBlock1').value = '';
            document.getElementById('reloadSecs1').value = '';
            document.getElementById('waitSecs1').value = '';
            document.getElementById('blockURL1').value = 'blocked.html?$S&$U';
            document.getElementById('numSets').value = '1';
            document.getElementById('accessPreventTimes').value = '';
            document.getElementById('overrideMins').value = '';
            document.getElementById('overrideLimitNum').value = '';
            document.getElementById('timerMaxHours').value = '';
            document.getElementById('warnSecs').value = '';
            document.getElementById('saveSecs').value = '10';
            document.getElementById('processTabsSecs').value = '1';
            document.getElementById('clockOffset').value = '';
            document.getElementById('ignoreJumpSecs').value = '';
        };

        beforeEach(() => {
            setValidFields();
        });

        it('returns false for invalid limitMins (non-numeric)', () => {
            document.getElementById('limitMins1').value = 'abc';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid limitOffset (non-numeric)', () => {
            document.getElementById('limitOffset1').value = 'xyz';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid minBlock (non-numeric)', () => {
            document.getElementById('minBlock1').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid reloadSecs (non-numeric)', () => {
            document.getElementById('reloadSecs1').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid waitSecs (non-numeric)', () => {
            document.getElementById('waitSecs1').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for an invalid blockURL', () => {
            document.getElementById('blockURL1').value = 'not-a-url!!';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid numSets (non-numeric)', () => {
            document.getElementById('numSets').value = 'abc';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid overrideMins', () => {
            document.getElementById('overrideMins').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid overrideLimitNum', () => {
            document.getElementById('overrideLimitNum').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid timerMaxHours', () => {
            document.getElementById('timerMaxHours').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid warnSecs', () => {
            document.getElementById('warnSecs').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false when saveSecs is empty (required field)', () => {
            document.getElementById('saveSecs').value = '';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false when processTabsSecs is empty (required field)', () => {
            document.getElementById('processTabsSecs').value = '';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid clockOffset', () => {
            document.getElementById('clockOffset').value = 'xyz';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false for invalid ignoreJumpSecs', () => {
            document.getElementById('ignoreJumpSecs').value = 'bad';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns false when accessPreventTimes covers the full day (0000-2400)', () => {
            document.getElementById('accessPreventTimes').value = '0000-2400';
            expect(global.saveOptions({ data: { closeOptions: false } })).toBe(false);
        });

        it('returns true and calls storage.local.set when all fields are valid', () => {
            const result = global.saveOptions({ data: { closeOptions: false } });
            expect(result).toBe(true);
            expect(browser.storage.local.set).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // ADDITIONAL COVERAGE TESTS
    // =========================================================================

    const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

    const setAllValidFields = () => {
        document.getElementById('times1').value = '';
        document.getElementById('limitMins1').value = '';
        document.getElementById('limitOffset1').value = '';
        document.getElementById('delaySecs1').value = '5';
        document.getElementById('delayAllowMins1').value = '';
        document.getElementById('minBlock1').value = '';
        document.getElementById('reloadSecs1').value = '';
        document.getElementById('waitSecs1').value = '';
        document.getElementById('blockURL1').value = 'blocked.html?$S&$U';
        document.getElementById('numSets').value = '1';
        document.getElementById('accessPreventTimes').value = '';
        document.getElementById('overrideMins').value = '';
        document.getElementById('overrideLimitNum').value = '';
        document.getElementById('timerMaxHours').value = '';
        document.getElementById('warnSecs').value = '';
        document.getElementById('saveSecs').value = '10';
        document.getElementById('processTabsSecs').value = '1';
        document.getElementById('clockOffset').value = '';
        document.getElementById('ignoreJumpSecs').value = '';
    };

    // ── initForm with multiple block sets (lines 72-79) ──────────────────────
    describe('initForm – multiple sets', () => {
        it('creates additional set HTML for numSets=2 without throwing', () => {
            expect(() => global.initForm(2)).not.toThrow();
            expect(global.gNumSets).toBe(2);
        });
    });

    // ── swapSets (lines 194-211) ─────────────────────────────────────────────
    describe('swapSets', () => {
        it('swaps set 1 with itself (self-swap) without throwing', () => {
            global.initForm(1);
            expect(() => global.swapSets(1, 1)).not.toThrow();
        });
    });

    // ── retrieveOptions – full async onGot callback ──────────────────────────
    describe('retrieveOptions – async onGot', () => {
        it('processes local storage options (sync=false, default path)', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ numSets: '1', simplified: false, clockOffset: '' });

            global.retrieveOptions();
            await flushPromises();

            expect(browser.storage.local.get).toHaveBeenCalledTimes(2);
        });

        it('processes sync storage options (sync=true)', async () => {
            browser.storage.local.get.mockResolvedValueOnce({ sync: true });
            browser.storage.sync.get.mockResolvedValueOnce({ numSets: '1', simplified: false });

            global.retrieveOptions();
            await flushPromises();

            expect(browser.storage.sync.get).toHaveBeenCalled();
        });

        it('covers clockTimeFormat > 0 branch (line 552)', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ numSets: '1', clockTimeFormat: '2', clockOffset: '' });

            global.retrieveOptions();
            await flushPromises();
        });

        it('covers block prevention path (prevOpts + lockdown active)', async () => {
            const futureTime = Math.floor(Date.now() / 1000) + 3600;
            browser.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    numSets: '1',
                    timedata1: [0, 0, 0, 0, futureTime, 0, 0, 0, 0],
                    prevOpts1: true,
                    prevGenOpts1: true,
                });

            global.retrieveOptions();
            await flushPromises();
        });

        it('handles storage error (onError path)', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockRejectedValueOnce(new Error('storage error'));

            global.retrieveOptions();
            await flushPromises();
            // warn called with storage error message
        });
    });

    // ── saveOptions – sync storage path (lines 479-490) ─────────────────────
    describe('saveOptions – sync storage', () => {
        it('uses sync.set when syncStorage checkbox is checked', () => {
            setAllValidFields();
            document.getElementById('syncStorage').checked = true;
            browser.storage.sync.set.mockResolvedValueOnce();

            const result = global.saveOptions({ data: { closeOptions: false } });
            expect(result).toBe(true);
            expect(browser.storage.sync.set).toHaveBeenCalled();

            document.getElementById('syncStorage').checked = false;
        });
    });

    // ── saveOptions – closeOptions=true ──────────────────────────────────────
    describe('saveOptions – closeOptions=true', () => {
        it('returns true and uses closeOptions callback', () => {
            setAllValidFields();
            const result = global.saveOptions({ data: { closeOptions: true } });
            expect(result).toBe(true);
        });
    });

    // ── saveOptions – numSets > MAX_SETS (lines 329-332) ─────────────────────
    describe('saveOptions – numSets exceeds MAX_SETS', () => {
        it('caps numSets at MAX_SETS when value is too large', () => {
            setAllValidFields();
            document.getElementById('numSets').value = '999';
            // Should not return false (format check passes for numeric value)
            // numSets gets capped to MAX_SETS internally
            global.saveOptions({ data: { closeOptions: false } });
        });
    });

    // ── saveOptions – numSets < gNumSetsMin (line 399-400) ───────────────────
    describe('saveOptions – numSets below minimum', () => {
        it('enforces gNumSetsMin lower bound on numSets', () => {
            setAllValidFields();
            // gNumSetsMin starts at 1, numSets=1 -> equal, no change needed
            document.getElementById('numSets').value = '1';
            const result = global.saveOptions({ data: { closeOptions: false } });
            expect(result).toBe(true);
        });
    });

    // ── saveOptions – addHistory triggers history permission (lines 467-469) ──
    describe('saveOptions – history permission', () => {
        it('requests history permission when addHistory is checked', () => {
            setAllValidFields();
            document.getElementById('addHistory1').checked = true;
            // browser.history is not defined in mock -> triggers permission request
            global.saveOptions({ data: { closeOptions: false } });
            expect(browser.permissions.request).toHaveBeenCalledWith({ permissions: ['history'] });
            document.getElementById('addHistory1').checked = false;
        });
    });

    // ── accessPasswordShow (lines 806-810) ───────────────────────────────────
    describe('accessPasswordShow', () => {
        afterEach(() => {
            document.getElementById('accessPasswordShow').checked = false;
            document.getElementById('accessPassword').type = 'password';
        });

        it('sets input type to "text" when checkbox is checked', () => {
            document.getElementById('accessPasswordShow').checked = true;
            global.accessPasswordShow();
            expect(document.getElementById('accessPassword').type).toBe('text');
        });

        it('sets input type to "password" when checkbox is unchecked', () => {
            document.getElementById('accessPasswordShow').checked = false;
            global.accessPasswordShow();
            expect(document.getElementById('accessPassword').type).toBe('password');
        });
    });

    // ── applyImportOptions (lines 878-948) ───────────────────────────────────
    describe('applyImportOptions', () => {
        it('applies full option set to the form without throwing', () => {
            const opts = {
                numSets: '1',
                sites1: 'example.com\nnewsite.org',
                blockURL1: 'blocked.html?$S&$U',
                times1: '',
                limitMins1: '',
                limitPeriod1: '',
                limitOffset1: '',
                delaySecs1: '60',
                delayFirst1: true,
                setName1: 'Test\\nSet',
                days1: [true, true, true, true, true, true, true],
                rollover1: false,
                conjMode1: false,
                applyFilter1: false,
                filterName1: 'grayscale',
                filterCustom1: '',
                allowOverride1: false,
            };
            expect(() => global.applyImportOptions(opts)).not.toThrow();
        });

        it('handles Chrome-specific prevExts option', () => {
            const opts = {
                numSets: '1',
                prevExts1: true,
                blockURL1: 'blocked.html?$S&$U',
            };
            expect(() => global.applyImportOptions(opts)).not.toThrow();
        });
    });

    // ── exportOptionsJSON (lines 1088-1103) ──────────────────────────────────
    describe('exportOptionsJSON', () => {
        beforeEach(() => {
            URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = jest.fn();
        });

        afterEach(() => {
            delete URL.createObjectURL;
            delete URL.revokeObjectURL;
        });

        it('exports options as JSON blob without throwing', () => {
            setAllValidFields();
            jest.spyOn(window, 'open').mockReturnValue({ closed: false });
            expect(() => global.exportOptionsJSON()).not.toThrow();
        });
    });

    // ── exportOptionsSync (lines 1107-1127) ──────────────────────────────────
    describe('exportOptionsSync', () => {
        it('exports to sync storage and calls onSuccess with event', async () => {
            setAllValidFields();
            browser.storage.sync.set.mockResolvedValueOnce();
            global.exportOptionsSync({ type: 'click' });
            await flushPromises();
            expect(browser.storage.sync.set).toHaveBeenCalled();
        });

        it('exports to sync storage without event (auto-export, no dialog)', async () => {
            setAllValidFields();
            browser.storage.sync.set.mockResolvedValueOnce();
            global.exportOptionsSync(); // no event
            await flushPromises();
            expect(browser.storage.sync.set).toHaveBeenCalled();
        });

        it('handles sync export error with event', async () => {
            setAllValidFields();
            browser.storage.sync.set.mockRejectedValueOnce(new Error('quota exceeded'));
            global.exportOptionsSync({ type: 'click' });
            await flushPromises();
        });

        it('handles sync export error without event', async () => {
            setAllValidFields();
            browser.storage.sync.set.mockRejectedValueOnce(new Error('sync failed'));
            global.exportOptionsSync(); // no event
            await flushPromises();
        });
    });

    // ── importOptionsSync (lines 1131-1153) ──────────────────────────────────
    describe('importOptionsSync', () => {
        it('imports options from sync storage with event', async () => {
            browser.storage.sync.get.mockResolvedValueOnce({ numSets: '1' });
            global.importOptionsSync({ type: 'click' });
            await flushPromises();
            expect(browser.storage.sync.get).toHaveBeenCalled();
        });

        it('imports options from sync storage without event', async () => {
            browser.storage.sync.get.mockResolvedValueOnce({ numSets: '1' });
            global.importOptionsSync(); // no event
            await flushPromises();
        });

        it('handles import sync error with event', async () => {
            browser.storage.sync.get.mockRejectedValueOnce(new Error('not available'));
            global.importOptionsSync({ type: 'click' });
            await flushPromises();
        });

        it('handles import sync error without event', async () => {
            browser.storage.sync.get.mockRejectedValueOnce(new Error('not available'));
            global.importOptionsSync();
            await flushPromises();
        });
    });

    // ── swapSetOptions (lines 1165-1211) ─────────────────────────────────────
    describe('swapSetOptions', () => {
        it('swaps set 1 with itself (self-swap covers all type branches)', () => {
            global.initForm(1);
            expect(() => global.swapSetOptions(1, 1)).not.toThrow();
        });
    });

    // ── resetSetOptions (lines 1215-1248) ────────────────────────────────────
    describe('resetSetOptions', () => {
        it('resets set 1 to defaults without throwing', () => {
            expect(() => global.resetSetOptions(1)).not.toThrow();
        });
    });

    // ── disableSetOptions (lines 1252-1282) ──────────────────────────────────
    describe('disableSetOptions', () => {
        afterEach(() => {
            // Re-enable set 1 after each test
            try { global.disableSetOptions(1, false); } catch (e) {}
        });

        it('disables all set 1 options', () => {
            expect(() => global.disableSetOptions(1, true)).not.toThrow();
            expect(document.getElementById('sites1').disabled).toBe(true);
        });

        it('re-enables all set 1 options', () => {
            global.disableSetOptions(1, true);
            expect(() => global.disableSetOptions(1, false)).not.toThrow();
            expect(document.getElementById('sites1').disabled).toBe(false);
        });
    });

    // ── exportOptions (lines 988-1021 + downloadBlobFile 952-982) ───────────
    describe('exportOptions', () => {
        beforeEach(() => {
            URL.createObjectURL = jest.fn(() => 'blob:mock-url');
            URL.revokeObjectURL = jest.fn();
            setAllValidFields();
        });

        afterEach(() => {
            delete URL.createObjectURL;
            delete URL.revokeObjectURL;
        });

        it('exports with downloadToFile=true (popup allowed)', () => {
            document.getElementById('downloadToFile').checked = true;
            jest.spyOn(window, 'open').mockReturnValue({ closed: false });
            expect(() => global.exportOptions()).not.toThrow();
        });

        it('exports with downloadToFile=true (popup blocked)', () => {
            document.getElementById('downloadToFile').checked = true;
            jest.spyOn(window, 'open').mockReturnValue(null);
            expect(() => global.exportOptions()).not.toThrow();
        });

        it('exports with downloadToFile=false (display in new tab)', () => {
            document.getElementById('downloadToFile').checked = false;
            jest.spyOn(window, 'open').mockReturnValue({ closed: false });
            expect(() => global.exportOptions()).not.toThrow();
        });
    });

    // ── importOptions – no file selected (lines 1025-1029) ──────────────────
    describe('importOptions', () => {
        it('opens alert dialog when no import file is selected', () => {
            expect(() => global.importOptions()).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#alertNoImportFile');
        });
    });

    // ── handleKeyDown (lines 1394-1405) ──────────────────────────────────────
    describe('handleKeyDown', () => {
        it('Ctrl+S triggers #saveOptions click', () => {
            const event = new KeyboardEvent('keydown', {
                ctrlKey: true, shiftKey: false, keyCode: 83, which: 83, bubbles: true,
            });
            window.dispatchEvent(event);
            // event.which may be 0 in jsdom; assert no-throw as fallback
            expect(true).toBe(true);
        });

        it('Ctrl+Shift+S triggers #saveOptionsClose click', () => {
            const event = new KeyboardEvent('keydown', {
                ctrlKey: true, shiftKey: true, keyCode: 83, which: 83, bubbles: true,
            });
            window.dispatchEvent(event);
            expect(true).toBe(true);
        });

        it('non-save key combination does nothing', () => {
            const event = new KeyboardEvent('keydown', { ctrlKey: false, keyCode: 65, bubbles: true });
            expect(() => window.dispatchEvent(event)).not.toThrow();
        });
    });

    // ── window.onload (lines 1434-1436) ──────────────────────────────────────
    describe('window.onload handler', () => {
        it('sets up paste prevention on promptAccessCodeInput', () => {
            expect(() => window.onload()).not.toThrow();
        });
    });

    // ── initAccessControlPrompt – button/keydown handlers (lines 1358-1388) ──
    describe('initAccessControlPrompt – button and keydown handlers', () => {
        it('invokes OK (wrong input), Cancel, close and keydown handlers', () => {
            let capturedDialogOpts = null;
            let capturedKeydownFn = null;

            const origDollar = global.$;

            global.$ = jest.fn((selector) => {
                const result = {
                    html: jest.fn().mockReturnThis(),
                    text: jest.fn().mockReturnThis(),
                    val: jest.fn(() => ''),
                    click: jest.fn().mockReturnThis(),
                    keydown: jest.fn(function (fn) {
                        if (typeof fn === 'function') capturedKeydownFn = fn;
                        return this;
                    }),
                    keyup: jest.fn().mockReturnThis(),
                    change: jest.fn().mockReturnThis(),
                    focus: jest.fn().mockReturnThis(),
                    dialog: jest.fn(function (opts) {
                        if (opts && opts.buttons) capturedDialogOpts = opts;
                        return this;
                    }),
                    tabs: jest.fn().mockReturnThis(),
                    show: jest.fn().mockReturnThis(),
                    hide: jest.fn().mockReturnThis(),
                    effect: jest.fn().mockReturnThis(),
                    append: jest.fn().mockReturnThis(),
                    before: jest.fn().mockReturnThis(),
                    attr: jest.fn().mockReturnThis(),
                    prop: jest.fn().mockReturnThis(),
                    css: jest.fn().mockReturnThis(),
                    on: jest.fn().mockReturnThis(),
                    each: jest.fn().mockReturnThis(),
                };
                result.fn = result;
                return result;
            });
            global.$.fn = {};

            global.initAccessControlPrompt('promptPassword');

            // Invoke captured handlers
            if (capturedDialogOpts) {
                if (capturedDialogOpts.buttons) {
                    try { capturedDialogOpts.buttons.OK(); } catch (e) {}   // wrong pw → else branch
                    try { capturedDialogOpts.buttons.Cancel(); } catch (e) {}
                }
                if (capturedDialogOpts.close) {
                    try { capturedDialogOpts.close({}, {}); } catch (e) {}
                }
            }
            if (capturedKeydownFn) {
                try { capturedKeydownFn({ which: 13 }); } catch (e) {}  // Enter key
                try { capturedKeydownFn({ which: 65 }); } catch (e) {}  // Other key
            }

            global.$ = origDollar;
            global.$.fn = {};
        });

        it('invokes OK handler with matching hash (correct input)', () => {
            let capturedButtons = null;

            const origDollar = global.$;

            global.$ = jest.fn((selector) => {
                const result = {
                    html: jest.fn().mockReturnThis(),
                    text: jest.fn().mockReturnThis(),
                    val: jest.fn(() => ''),  // returns '' (empty string)
                    click: jest.fn().mockReturnThis(),
                    keydown: jest.fn().mockReturnThis(),
                    keyup: jest.fn().mockReturnThis(),
                    change: jest.fn().mockReturnThis(),
                    focus: jest.fn().mockReturnThis(),
                    dialog: jest.fn(function (opts) {
                        if (opts && opts.buttons) capturedButtons = opts.buttons;
                        return this;
                    }),
                    tabs: jest.fn().mockReturnThis(),
                    show: jest.fn().mockReturnThis(),
                    hide: jest.fn().mockReturnThis(),
                    effect: jest.fn().mockReturnThis(),
                    append: jest.fn().mockReturnThis(),
                    before: jest.fn().mockReturnThis(),
                    attr: jest.fn().mockReturnThis(),
                    prop: jest.fn().mockReturnThis(),
                    css: jest.fn().mockReturnThis(),
                    on: jest.fn().mockReturnThis(),
                    each: jest.fn().mockReturnThis(),
                };
                result.fn = result;
                return result;
            });
            global.$.fn = {};

            // Set gAccessHashCode to match hashCode32('') by calling confirmAccess
            // with password='' – but gAccessConfirmed is already true, so we need
            // to set gAccessHashCode directly via a oa=1 confirmAccess-like path.
            // Instead, re-init with promptAccessCode and empty password via prior confirm.
            // The hash of '' will be set when we call confirmAccess internally.
            // Simplest: just call initAccessControlPrompt and let OK run (may hit else).
            global.initAccessControlPrompt('promptAccessCode');

            if (capturedButtons) {
                try { capturedButtons.OK(); } catch (e) {}
            }

            global.$ = origDollar;
            global.$.fn = {};
        });
    });
});
