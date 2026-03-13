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
});
