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
        remove: jest.fn(),
        sendMessage: jest.fn(() => Promise.resolve()),
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

    describe('allowBlockedPage', () => {
        const defaultOptions = {
            delayFirst1: true, delayFirstMode1: '0', delayAllowMins1: '',
            delayAutoLoad1: true
        };

        beforeEach(() => {
            global.setBackgroundState({
                gGotOptions: false,
                gNumSets: 1,
                gTabs: [],
                gPendingAllows: [],
                gOptions: { ...defaultOptions }
            });
            browserMock.tabs.update.mockClear();
        });

        it('queues allow when gGotOptions is false (service worker restart)', () => {
            global.allowBlockedPage(42, 'https://example.com', '1', true);
            const state = global.getBackgroundState();
            expect(state.gPendingAllows).toEqual([{ id: 42, url: 'https://example.com', set: '1' }]);
            expect(browserMock.tabs.update).not.toHaveBeenCalled();
        });

        it('processes pending allows immediately when options are already loaded', () => {
            global.setBackgroundState({ gGotOptions: true });
            global.allowBlockedPage(42, 'https://example.com', '1', true);
            const state = global.getBackgroundState();
            expect(state.gPendingAllows).toHaveLength(0);
            expect(browserMock.tabs.update).toHaveBeenCalledWith(42, { url: 'https://example.com' });
        });

        it('creates gTabs entry if tab not yet tracked (no TypeError)', () => {
            global.setBackgroundState({ gGotOptions: true });
            expect(() => {
                global.allowBlockedPage(99, 'https://example.com', '1', false);
            }).not.toThrow();
            const state = global.getBackgroundState();
            expect(state.gTabs[99]).toBeDefined();
            expect(state.gTabs[99].allowedSet).toBe('1');
        });

        it('does not navigate if autoLoad is false', () => {
            global.setBackgroundState({ gGotOptions: true });
            global.allowBlockedPage(42, 'https://example.com', '1', false);
            expect(browserMock.tabs.update).not.toHaveBeenCalled();
        });
    });

    describe('createRegExps', () => {
        it('creates block and allow regexps from option strings', () => {
            global.setBackgroundState({
                gNumSets: 1,
                gOptions: { regexpBlock1: 'example\\.com', regexpAllow1: 'allowed\\.com' }
            });
            expect(() => global.createRegExps()).not.toThrow();
        });

        it('handles missing regexp options gracefully (null regexps)', () => {
            global.setBackgroundState({ gNumSets: 1, gOptions: {} });
            expect(() => global.createRegExps()).not.toThrow();
        });

        it('uses legacy blockRE option when regexpBlock is absent', () => {
            global.setBackgroundState({
                gNumSets: 2,
                gOptions: { blockRE1: 'legacy\\.com', referRE1: 'ref\\.com', keywordRE2: 'word' }
            });
            expect(() => global.createRegExps()).not.toThrow();
        });
    });

    describe('restartTimeData', () => {
        it('does nothing when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gNumSets: 1, gOptions: {} });
            expect(() => global.restartTimeData(1)).not.toThrow();
        });

        it('resets used-time for a specific set to zero', () => {
            global.setBackgroundState({
                gGotOptions: true,
                gNumSets: 1,
                gOptions: { timedata1: [0, 999, 0, 0, 0, 0, 0] }
            });
            global.restartTimeData(1);
            const state = global.getBackgroundState();
            expect(state.gOptions['timedata1'][1]).toBe(0);
        });

        it('resets all sets when set argument is 0', () => {
            global.setBackgroundState({
                gGotOptions: true,
                gNumSets: 2,
                gOptions: { timedata1: [0, 10, 0, 0, 0], timedata2: [0, 20, 0, 0, 0] }
            });
            global.restartTimeData(0);
            const state = global.getBackgroundState();
            expect(state.gOptions['timedata1'][1]).toBe(0);
            expect(state.gOptions['timedata2'][1]).toBe(0);
        });
    });

    describe('reorderTimeData', () => {
        it('does nothing with null ordering', () => {
            global.setBackgroundState({ gNumSets: 1, gOptions: { timedata1: [1, 2, 3] } });
            expect(() => global.reorderTimeData(null)).not.toThrow();
        });

        it('swaps timedata between two sets according to ordering', () => {
            global.setBackgroundState({
                gGotOptions: true,
                gNumSets: 2,
                gOptions: { timedata1: [111, 0, 0], timedata2: [222, 0, 0] }
            });
            // ordering[1]=2 means set 1 gets the data that was in set 2, and vice versa
            global.reorderTimeData([null, 2, 1]);
            const state = global.getBackgroundState();
            expect(state.gOptions['timedata1'][0]).toBe(222);
            expect(state.gOptions['timedata2'][0]).toBe(111);
        });
    });

    describe('applyLockdown', () => {
        it('does nothing when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gNumSets: 1, gOptions: {} });
            expect(() => global.applyLockdown(1, 9999999)).not.toThrow();
        });

        it('does nothing when set is out of range', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0] }
            });
            expect(() => global.applyLockdown(2, 9999999)).not.toThrow();
        });

        it('sets lockdown end time for a valid set', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0] }
            });
            global.applyLockdown(1, 9999999);
            const state = global.getBackgroundState();
            expect(state.gOptions['timedata1'][4]).toBe(9999999);
        });
    });

    describe('cancelLockdown', () => {
        it('does nothing when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gNumSets: 1, gOptions: {} });
            expect(() => global.cancelLockdown(1)).not.toThrow();
        });

        it('clears lockdown end time to zero', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 9999999, 0, 0] }
            });
            global.cancelLockdown(1);
            const state = global.getBackgroundState();
            expect(state.gOptions['timedata1'][4]).toBe(0);
        });
    });

    describe('applyOverride', () => {
        it('does nothing when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gOptions: {} });
            expect(() => global.applyOverride(9999999)).not.toThrow();
        });

        it('sets override end time in options', () => {
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 0, orln: null, orlp: null, orlps: 0, orlc: 0 }
            });
            global.applyOverride(9999999);
            const state = global.getBackgroundState();
            expect(state.gOptions['oret']).toBe(9999999);
        });

        it('clears override when endTime is 0', () => {
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 9999999 }
            });
            global.applyOverride(0);
            const state = global.getBackgroundState();
            expect(state.gOptions['oret']).toBe(0);
        });
    });

    describe('addSiteToSet', () => {
        it('does nothing when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gNumSets: 1, gOptions: {} });
            expect(() => global.addSiteToSet('http://example.com', 1, false)).not.toThrow();
        });

        it('does nothing for a non-http URL', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { sites1: '', matchSubdomains: false }
            });
            expect(() => global.addSiteToSet('ftp://example.com', 1, false)).not.toThrow();
        });

        it('adds a new http site to the block set options', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    sites1: '',
                    blockRE1: '', allowRE1: '', referRE1: '', keywordRE1: '',
                    matchSubdomains: false
                }
            });
            global.addSiteToSet('http://newsite.com/page', 1, false);
            const state = global.getBackgroundState();
            expect(state.gOptions['sites1']).toContain('newsite.com');
        });
    });

    describe('handleTabCreated', () => {
        it('initializes a newly created tab', () => {
            global.setBackgroundState({ gTabs: [] });
            global.handleTabCreated({ id: 10 });
            const state = global.getBackgroundState();
            expect(state.gTabs[10]).toBeDefined();
            expect(state.gTabs[10].url).toBe('about:blank');
        });

        it('inherits allowed properties from the opener tab', () => {
            const tabs = [];
            tabs[5] = { allowedHost: 'example.com', allowedPath: '/p', allowedSet: '1', allowedEndTime: 9999 };
            global.setBackgroundState({ gTabs: tabs });
            global.handleTabCreated({ id: 20, openerTabId: 5 });
            const state = global.getBackgroundState();
            expect(state.gTabs[20].allowedHost).toBe('example.com');
            expect(state.gTabs[20].allowedSet).toBe('1');
        });
    });

    describe('handleTabUpdated', () => {
        it('still initializes tab even when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gTabs: [] });
            global.handleTabUpdated(30, {}, { id: 30, active: false, incognito: false, audible: false });
            const state = global.getBackgroundState();
            expect(state.gTabs[30]).toBeDefined();
        });

        it('updates tab url when changeInfo.url is provided', () => {
            global.setBackgroundState({
                gGotOptions: true, gTabs: [],
                gOptions: {}
            });
            global.handleTabUpdated(31, { url: 'http://example.com' }, { id: 31, active: false, incognito: false, audible: false });
            const state = global.getBackgroundState();
            expect(state.gTabs[31].url).toContain('example.com');
        });
    });

    describe('handleTabActivated', () => {
        it('sets gActiveTabId and initializes tab even when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gTabs: [] });
            global.handleTabActivated({ tabId: 40, previousTabId: 39, windowId: 1 });
            const state = global.getBackgroundState();
            expect(state.gTabs[40]).toBeDefined();
            expect(state.gTabs[40].focused).toBe(true);
        });

        it('marks tab as focused when gGotOptions is true', () => {
            global.setBackgroundState({
                gGotOptions: true, gTabs: [],
                gOptions: { processActiveTabs: false }
            });
            global.handleTabActivated({ tabId: 41, previousTabId: 0, windowId: 1 });
            const state = global.getBackgroundState();
            expect(state.gTabs[41].focused).toBe(true);
        });
    });

    describe('handleTabRemoved', () => {
        it('returns early without error when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gTabs: [] });
            expect(() => global.handleTabRemoved(50, {})).not.toThrow();
        });

        it('removes the tab entry from gTabs when gGotOptions is true', () => {
            const tabs = [];
            tabs[51] = { url: 'http://example.com', clockable: false };
            global.setBackgroundState({ gGotOptions: true, gTabs: tabs });
            global.handleTabRemoved(51, {});
            const state = global.getBackgroundState();
            expect(state.gTabs[51]).toBeUndefined();
        });
    });

    describe('handleMessage', () => {
        let mockSendResponse;

        beforeEach(() => {
            mockSendResponse = jest.fn();
            browserMock.tabs.remove.mockClear();
            const tabs = [];
            tabs[60] = { url: 'http://example.com', focused: false, loaded: false, clockable: false, referrer: '' };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0] }
            });
        });

        it('returns early (warns) when sender is missing', () => {
            expect(() => global.handleMessage({ type: 'focus', focus: true }, null, mockSendResponse)).not.toThrow();
        });

        it('handles "focus" message by updating tab focused state', () => {
            global.handleMessage({ type: 'focus', focus: true }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gTabs[60].focused).toBe(true);
        });

        it('handles "referrer" message by storing the referrer URL', () => {
            global.handleMessage({ type: 'referrer', referrer: 'http://ref.com' }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gTabs[60].referrer).toBe('http://ref.com');
        });

        it('handles "loaded" message by marking tab as loaded', () => {
            global.handleMessage({ type: 'loaded', url: 'http://example.com' }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gTabs[60].loaded).toBe(true);
        });

        it('handles "close" message by calling browser.tabs.remove', () => {
            global.handleMessage({ type: 'close' }, { tab: { id: 60 } }, mockSendResponse);
            expect(browserMock.tabs.remove).toHaveBeenCalledWith(60);
        });
    });
});