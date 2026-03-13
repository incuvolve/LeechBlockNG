/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Comprehensive browser mock — must be set before require('../background.js')
// because background.js calls browser.runtime.getURL(...) and browser.storage.local
// at module load time, and registers many listeners at startup.
const mockListener = { addListener: jest.fn() };

const browserMock = {
    runtime: {
        getURL: jest.fn((path) => `moz-extension://test-id/${path}`),
        getPlatformInfo: jest.fn(() => Promise.resolve({ os: 'mac' })),
        onMessage: mockListener,
        sendMessage: jest.fn(),
    },
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({})),
            set: jest.fn(() => Promise.resolve()),
        },
        sync: {
            get: jest.fn(() => Promise.resolve({})),
            set: jest.fn(() => Promise.resolve()),
        },
    },
    tabs: {
        query: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        create: jest.fn(),
        onCreated: mockListener,
        onUpdated: mockListener,
        onActivated: mockListener,
        onRemoved: mockListener,
    },
    action: {
        setPopup: jest.fn(),
        setIcon: jest.fn(),
        setBadgeText: jest.fn(),
        setBadgeBackgroundColor: jest.fn(),
    },
    menus: {
        create: jest.fn(),
        removeAll: jest.fn(),
        onClicked: mockListener,
    },
    commands: {
        onCommand: mockListener,
    },
    webNavigation: {
        onBeforeNavigate: mockListener,
    },
    windows: {
        onFocusChanged: mockListener,
    },
    alarms: {
        create: jest.fn(),
        onAlarm: mockListener,
    },
    i18n: {
        getMessage: jest.fn((key) => key),
    },
};

global.browser = browserMock;

jest.useFakeTimers();

require('../common.js');
require('../background.js');

describe('background.js tests', () => {
    describe('testURL', () => {
        const blockRE = /example\.com/;
        const allowRE = /allowed\.example\.com/;
        const referRE = /referrer\.com/;

        it('should block a matching URL', () => {
            expect(!!global.testURL('http://example.com', '', blockRE, null, null, false)).toBe(true);
        });

        it('should not block a non-matching URL', () => {
            expect(!!global.testURL('http://another-site.com', '', blockRE, null, null, false)).toBe(false);
        });

        it('should not block an allowed URL even if it matches the block pattern', () => {
            expect(!!global.testURL('http://allowed.example.com', '', blockRE, allowRE, null, false)).toBe(false);
        });

        it('should block based on referrer when allowRefers is false', () => {
            expect(!!global.testURL('http://any-site.com', 'http://referrer.com', null, null, referRE, false)).toBe(true);
        });

        it('should not block based on referrer when allowRefers is true', () => {
            expect(!!global.testURL('http://example.com', 'http://referrer.com', blockRE, null, referRE, true)).toBe(false);
        });

        it('should block if block pattern matches and referrer does not, when allowRefers is true', () => {
            expect(!!global.testURL('http://example.com', 'http://google.com', blockRE, null, referRE, true)).toBe(true);
        });
    });
});