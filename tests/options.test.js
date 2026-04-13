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
    beforeEach(() => {
        jest.clearAllMocks();
        global.gNumSets = 1;
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
});
