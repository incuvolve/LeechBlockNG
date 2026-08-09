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
        openOptionsPage: jest.fn(),
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
        update: jest.fn(),
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
global.IVBLOCK_URL = 'https://www.incuvolve.de/ivblock/';

jest.useFakeTimers();

require('../common.js');
require('../background.js');

describe('background.js tests', () => {
    let consoleWarnSpy;

    beforeAll(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleWarnSpy.mockRestore();
    });

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

    // ── shared constants ──────────────────────────────────────────────────────
    const FULL_OPTIONS = {
        sync: false,
        numSets: '1',
        clockOffset: '0',
        ignoreJumpSecs: '0',
        processTabsSecs: '1',
        saveSecs: '10',
        contextMenu: false,
        allFocused: false,
        useDocFocus: false,
        diagMode: false,
        theme: '',
        timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        times1: '',
        sites1: '',
        sitesURL1: '',
        blockRE1: '',
        allowRE1: '',
        referRE1: '',
        keywordRE1: '',
        setName1: '',
        regexpBlock1: '',
        regexpAllow1: '',
        limitMins1: '',
        limitPeriod1: '',
        limitOffset1: '',
        rollover1: false,
        conjMode1: false,
        days1: [true, true, true, true, true, true, true],
        matchSubdomains: false,
    };

    // Add mock methods that background.js uses but weren't in the initial mock
    browserMock.runtime.openOptionsPage = jest.fn();
    browserMock.action.setTitle = jest.fn();
    browserMock.windows.getCurrent = jest.fn(() =>
        Promise.resolve({ focused: true, id: 1 })
    );

    // Icon constants used by background.js but not exported by common.js to window
    global.OVERRIDE_ICON = { 16: 'icons/ivblock16o.png', 32: 'icons/ivblock32o.png' };
    global.DEFAULT_ICON  = { 16: 'icons/ivblock16.png',  32: 'icons/ivblock32.png'  };

    // Flush promise microtask queue (compatible with jest.useFakeTimers —
    // Promise microtasks are NOT faked, only setTimeout/setInterval are)
    const flushPromises = () =>
        Promise.resolve()
            .then(() => Promise.resolve())
            .then(() => Promise.resolve())
            .then(() => Promise.resolve())
            .then(() => Promise.resolve())
            .then(() => Promise.resolve())
            .then(() => Promise.resolve());

    // ── retrieveOptions ───────────────────────────────────────────────────────
    describe('retrieveOptions', () => {
        beforeEach(() => {
            browserMock.storage.local.get.mockClear();
            browserMock.storage.sync.get.mockClear();
            browserMock.menus.removeAll.mockClear();
        });

        it('loads options from local storage when sync=false', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...FULL_OPTIONS });
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gGotOptions).toBe(true);
            expect(browserMock.menus.removeAll).toHaveBeenCalled();
        });

        it('loads options from sync storage when sync=true', async () => {
            browserMock.storage.local.get.mockResolvedValueOnce({ sync: true });
            browserMock.storage.sync.get.mockResolvedValueOnce({ ...FULL_OPTIONS });
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gGotOptions).toBe(true);
        });

        it('sets gGotOptions=false on storage error', async () => {
            browserMock.storage.local.get.mockRejectedValueOnce(new Error('fail'));
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gGotOptions).toBe(false);
        });

        it('processes pending allows after options load', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...FULL_OPTIONS, delayAutoLoad1: false });
            global.setBackgroundState({
                gGotOptions: false,
                gOptions: {},
                gNumSets: 1,
                gPendingAllows: [{ id: 99, url: 'http://safe.com', set: '1' }],
            });
            global.retrieveOptions(false);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gPendingAllows).toHaveLength(0);
        });

        it('skips timedata when update=true', async () => {
            const opts = { ...FULL_OPTIONS, timedata1: [100, 200, 0, 0, 0, 0, 0, 0, 0] };
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce(opts);
            global.setBackgroundState({
                gGotOptions: false,
                gOptions: { timedata1: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
                gNumSets: 1,
            });
            global.retrieveOptions(true);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gGotOptions).toBe(true);
            // update=true means timedata from storage is NOT copied
            expect(state.gOptions.timedata1[0]).toBe(1);
        });

        it('refreshes context menu with numSets > 1', async () => {
            const opts = {
                ...FULL_OPTIONS,
                numSets: '2',
                timedata2: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                times2: '', sites2: '', sitesURL2: '', blockRE2: '', allowRE2: '',
                referRE2: '', keywordRE2: '', setName2: '', regexpBlock2: '',
                regexpAllow2: '', limitMins2: '', limitPeriod2: '', limitOffset2: '',
                rollover2: false, conjMode2: false,
                days2: [true, true, true, true, true, true, true],
            };
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce(opts);
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            expect(browserMock.menus.create).toHaveBeenCalled();
        });
    });

    // ── loadSiteLists (via retrieveOptions with sitesURL) ─────────────────────
    describe('loadSiteLists', () => {
        beforeEach(() => {
            browserMock.storage.local.get.mockClear();
            browserMock.storage.local.set.mockClear();
        });

        it('fetches sites from sitesURL on 200 response', async () => {
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    status: 200,
                    text: () => Promise.resolve('example.com\nsafe.net'),
                })
            );
            const opts = { ...FULL_OPTIONS, sitesURL1: 'https://example.com/list.txt' };
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce(opts);
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            await flushPromises();
            expect(global.fetch).toHaveBeenCalled();
        });

        it('handles non-200 sitesURL response gracefully', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ status: 404 }));
            const opts = { ...FULL_OPTIONS, sitesURL1: 'https://example.com/list.txt' };
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce(opts);
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            await flushPromises();
        });

        it('handles network error on fetch gracefully', async () => {
            global.fetch = jest.fn(() => Promise.reject(new Error('network error')));
            const opts = { ...FULL_OPTIONS, sitesURL1: 'https://example.com/list.txt' };
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce(opts);
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            await flushPromises();
        });
    });

    // ── saveTimeData ──────────────────────────────────────────────────────────
    describe('saveTimeData', () => {
        it('writes changed timedata to storage', () => {
            browserMock.storage.local.set.mockClear();
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 999, 0, 0, 0, 0, 0, 0, 0] },
            });
            // reorderTimeData([null,1]) is a no-op reorder but still calls saveTimeData
            global.reorderTimeData([null, 1]);
            expect(browserMock.storage.local.set).toHaveBeenCalled();
        });

        it('returns early (no write) when gGotOptions is false', () => {
            browserMock.storage.local.set.mockClear();
            global.setBackgroundState({
                gGotOptions: false, gNumSets: 2,
                gOptions: {
                    timedata1: [1, 2, 3, 4, 5, 6, 7, 8, 9],
                    timedata2: [10, 11, 12, 13, 14, 15, 16, 17, 18],
                },
            });
            global.reorderTimeData([null, 2, 1]);
            // saveTimeData returns early because gGotOptions=false
            expect(browserMock.storage.local.set).not.toHaveBeenCalled();
        });
    });

    // ── processTabs ───────────────────────────────────────────────────────────
    describe('processTabs via handleTabActivated', () => {
        beforeEach(() => {
            browserMock.tabs.query.mockReset();
            browserMock.tabs.query.mockResolvedValue([]);
        });

        it('calls tabs.query when processActiveTabs=true', async () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: true,
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '', limitMins1: '', allFocused: false,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabActivated({ tabId: 201, previousTabId: 0, windowId: 1 });
            await flushPromises();
            expect(browserMock.tabs.query).toHaveBeenCalled();
        });

        it('marks about: URL tabs as loaded immediately', async () => {
            const tabs = [];
            tabs[230] = {
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', url: 'about:blank', incog: false, audible: false,
                focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: true,
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '', limitMins1: '', allFocused: false, oret: 0,
                },
                gTabs: tabs,
            });
            global.createRegExps();
            browserMock.tabs.query.mockResolvedValueOnce([
                { id: 230, url: 'about:newtab', active: true, audible: false, incognito: false, windowId: 1 },
            ]);
            global.handleTabActivated({ tabId: 230, previousTabId: 0, windowId: 1 });
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gTabs[230].loaded).toBe(true);
        });

        it('pings unloaded clockable tabs', async () => {
            browserMock.tabs.sendMessage.mockClear();
            const tabs = [];
            tabs[231] = {
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', url: 'http://example.com', incog: false, audible: false,
                focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: true,
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '', limitMins1: '', allFocused: false, oret: 0,
                },
                gTabs: tabs,
            });
            global.createRegExps();
            browserMock.tabs.query.mockResolvedValueOnce([
                { id: 231, url: 'http://example.com', active: false, audible: false, incognito: false, windowId: 1 },
            ]);
            global.handleTabActivated({ tabId: 231, previousTabId: 0, windowId: 1 });
            await flushPromises();
            expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(231, { type: 'ping' });
        });

        it('handles tabs.query rejection gracefully', async () => {
            browserMock.tabs.query.mockRejectedValueOnce(new Error('query error'));
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: true, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false },
                gTabs: [],
            });
            global.createRegExps();
            expect(() =>
                global.handleTabActivated({ tabId: 202, previousTabId: 0, windowId: 1 })
            ).not.toThrow();
            await flushPromises();
        });
    });

    // ── clockPageTime + updateTimeData ────────────────────────────────────────
    describe('clockPageTime and updateTimeData', () => {
        it('computes elapsed open/focus time and calls updateTimeData', async () => {
            const t = Date.now();
            const tabs = [];
            tabs[400] = {
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', url: 'http://example.com', incog: false, audible: false,
                focused: true, loaded: true, loadedTime: t - 10000,
                clockable: true,
                openTime: t - 5000,
                focusTime: t - 5000,
                secsLeft: Infinity, secsLeftSet: 0, showTimer: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: true,
                    regexpBlock1: 'example\\.com',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '', limitMins1: '', days1: [true, true, true, true, true, true, true],
                    allFocused: false, oret: 0,
                },
                gTabs: tabs,
            });
            global.createRegExps();
            browserMock.tabs.query.mockResolvedValueOnce([
                { id: 400, url: 'http://example.com', active: true, audible: false, incognito: false, windowId: 1 },
            ]);
            global.handleTabActivated({ tabId: 400, previousTabId: 0, windowId: 1 });
            await flushPromises();
            const state = global.getBackgroundState();
            // updateTimeData was called — total time spent should be > 0
            expect(state.gOptions.timedata1[1]).toBeGreaterThan(0);
        });

        it('clears openTime/focusTime for non-clockable tab', () => {
            const tabs = [];
            tabs[401] = {
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', url: 'http://example.com', incog: false, audible: false,
                focused: false, loaded: false, loadedTime: 0,
                clockable: false,
                openTime: Date.now() - 3000,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: tabs,
            });
            global.createRegExps();
            // handleTabUpdated calls clockPageTime(id, true, focus); clockable=false → returns early
            global.handleTabUpdated(401, { status: 'complete' },
                { id: 401, active: false, incognito: false, audible: false, windowId: 1, url: 'http://example.com' });
            const state = global.getBackgroundState();
            expect(state.gTabs[401].openTime).toBeUndefined();
        });
    });

    // ── checkTab ──────────────────────────────────────────────────────────────
    describe('checkTab via handleTabUpdated', () => {
        beforeEach(async () => {
            await flushPromises();
            browserMock.tabs.update.mockClear();
            browserMock.tabs.remove.mockClear();
            browserMock.tabs.sendMessage.mockClear();
            browserMock.tabs.query.mockReset();
            browserMock.tabs.query.mockResolvedValue([]);
            global.setBackgroundState({
                gGotOptions: false,
                gNumSets: 1,
                gTabs: [],
                gPendingAllows: [],
                gDelayedTabIds: {},
                gDelayAllowances: [],
                gOptions: {},
            });
        });

        it('exits early for about:blank URL', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(300, { status: 'complete', url: 'about:blank' },
                { id: 300, active: false, incognito: false, audible: false, windowId: 1, url: 'about:blank' });
            expect(browserMock.tabs.update).not.toHaveBeenCalled();
        });

        it('runs through checkTab for http URL with no block RE', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(301, { status: 'complete', url: 'http://safe.com' },
                { id: 301, active: true, incognito: false, audible: false, windowId: 1, url: 'http://safe.com' });
            const state = global.getBackgroundState();
            expect(state.gTabs[301]).toBeDefined();
        });

        it('blocks URL matching block pattern (0000-2400 times)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'blocked\\.example\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false, minBlock1: '',
                    oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(302, { status: 'complete', url: 'http://blocked.example.com/page' },
                { id: 302, active: false, incognito: false, audible: false, windowId: 1, url: 'http://blocked.example.com/page' });
            expect(browserMock.tabs.update).toHaveBeenCalledWith(302, expect.objectContaining({ url: expect.stringContaining('blocked.html') }));
        });

        it('closes tab when closeTab1 option is set', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'closeme\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: '',
                    closeTab1: true, applyFilter1: false, minBlock1: '',
                    oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(303, { status: 'complete', url: 'http://closeme.com/page' },
                { id: 303, active: false, incognito: false, audible: false, windowId: 1, url: 'http://closeme.com/page' });
            expect(browserMock.tabs.remove).toHaveBeenCalledWith(303);
        });

        it('applies CSS filter instead of redirect when applyFilter1 is set', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'filterme\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: '',
                    closeTab1: false, applyFilter1: true, filterName1: 'blur', filterMute1: true,
                    minBlock1: '', oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(304, { status: 'complete', url: 'http://filterme.com/page' },
                { id: 304, active: false, incognito: false, audible: false, windowId: 1, url: 'http://filterme.com/page' });
            expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(304, expect.objectContaining({ type: 'filter' }));
        });

        it('does NOT block when override is active', () => {
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'override\\.example\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false, minBlock1: '',
                    oret: now + 3600,
                    allowOverride1: true,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(305, { status: 'complete' },
                { id: 305, active: true, incognito: false, audible: false, windowId: 1, url: 'http://override.example.com/page' });
            // With active override, the redirect should NOT happen
            expect(browserMock.tabs.update).not.toHaveBeenCalledWith(305, expect.objectContaining({ url: expect.stringContaining('blocked.html') }));
        });

        it('blocks after time limit is exceeded', () => {
            const now = Math.floor(Date.now() / 1000);
            const periodStart = global.getTimePeriodStart(now, '86400', '');
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'timelimit\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 7200, periodStart, 7200, 0, 0, 0, 0, 0],
                    times1: '',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '60',
                    limitPeriod1: '86400',
                    limitOffset1: '',
                    rollover1: false, conjMode1: false,
                    allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false, minBlock1: '',
                    oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(306, { status: 'complete', url: 'http://timelimit.com/page' },
                { id: 306, active: false, incognito: false, audible: false, windowId: 1, url: 'http://timelimit.com/page' });
            expect(browserMock.tabs.update).toHaveBeenCalledWith(306, expect.any(Object));
        });

        it('enforces minimum block time on first block', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'minblock\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false,
                    minBlock1: '5',
                    oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(307, { status: 'complete', url: 'http://minblock.com/page' },
                { id: 307, active: false, incognito: false, audible: false, windowId: 1, url: 'http://minblock.com/page' });
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[8]).toBeGreaterThan(0);
        });

        it('updates timer for active unblocked tab', () => {
            browserMock.tabs.sendMessage.mockClear();
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(308, { status: 'complete', url: 'http://safe.com' },
                { id: 308, active: true, incognito: false, audible: false, windowId: 1, url: 'http://safe.com' });
            expect(browserMock.tabs.sendMessage).toHaveBeenCalledWith(308, expect.objectContaining({ type: 'timer' }));
        });
    });

    // ── checkWarning ──────────────────────────────────────────────────────────
    describe('checkWarning', () => {
        it('sends warning alert when secsLeft <= warnSecs', async () => {
            browserMock.tabs.sendMessage.mockClear();
            browserMock.tabs.query.mockReset();
            const t = Date.now();
            const now = Math.floor(t / 1000);
            const periodStart = global.getTimePeriodStart(now, '86400', '');
            // Tab that has ~30 seconds left on its time limit
            const tabs = [];
            tabs[320] = {
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', url: 'http://warn.example.com', incog: false, audible: false,
                focused: true, loaded: true, loadedTime: t - 5000,
                clockable: true,
                openTime: t - 5000,
                secsLeft: Infinity, secsLeftSet: 0, showTimer: false, warned: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: true,
                    regexpBlock1: 'warn\\.example\\.com',
                    regexpAllow1: '',
                    // timedata[3] = 3570 secs spent → 30 secs left on 3600-sec limit
                    timedata1: [0, 3570, periodStart, 3570, 0, 0, 0, 0, 0],
                    times1: '',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '60',
                    limitPeriod1: '86400',
                    limitOffset1: '',
                    rollover1: false, conjMode1: false,
                    allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false, minBlock1: '',
                    oret: 0,
                    warnSecs: 60,
                    showTimer1: true,
                },
                gTabs: tabs,
            });
            global.createRegExps();
            browserMock.tabs.query.mockResolvedValueOnce([
                { id: 320, url: 'http://warn.example.com', active: true, audible: false, incognito: false, windowId: 1 },
            ]);
            global.handleTabActivated({ tabId: 320, previousTabId: 0, windowId: 1 });
            await flushPromises();
            // Warning alert should have been sent
            const calls = browserMock.tabs.sendMessage.mock.calls;
            const alertCall = calls.find(c => c[1] && c[1].type === 'alert');
            expect(alertCall).toBeDefined();
        });
    });

    // ── updateIcon ────────────────────────────────────────────────────────────
    describe('updateIcon', () => {
        it('sets override icon when override end time is in the future', async () => {
            browserMock.action.setIcon.mockClear();
            const now = Math.floor(Date.now() / 1000);
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...FULL_OPTIONS, oret: now + 3600 });
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.retrieveOptions(false);
            await flushPromises();
            expect(browserMock.action.setIcon).toHaveBeenCalledWith(expect.objectContaining({ path: expect.anything() }));
        });
    });

    // ── createBlockInfo + getUnblockTime ──────────────────────────────────────
    describe('createBlockInfo and getUnblockTime', () => {
        it('returns full block info for a blocked page URL', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[70] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '', limitMins1: '', limitPeriod1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: false, rollover1: false,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 70 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalledWith(expect.objectContaining({ tabId: 70 }));
        });

        it('returns minimal info when URL has no query args', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[71] = { url: 'http://example.com', focused: false, loaded: true, clockable: false, referrer: '' };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { theme: '', customStyle: '' },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 71 }, url: 'moz-extension://test-id/blocked.html' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('returns block info when gGotOptions is false (getUnblockTime returns null)', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[72] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            global.setBackgroundState({
                gGotOptions: false, gNumSets: 1, gTabs: tabs,
                gOptions: { theme: '', customStyle: '' },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 72 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('getUnblockTime: covers time-period-only case (Case 1)', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[73] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    limitMins1: '', limitPeriod1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: false, rollover1: false,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 73 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('getUnblockTime: covers time-limit-only case (Case 2)', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[74] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 7200, now - 3600, 7200, 0, 0, 0, 0, 0],
                    times1: '',
                    limitMins1: '60', limitPeriod1: '86400', limitOffset1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: false, rollover1: false,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 74 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('getUnblockTime: covers conjMode (Case 3: periods AND limit)', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[75] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 7200, now - 3600, 7200, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    limitMins1: '60', limitPeriod1: '86400', limitOffset1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: true, rollover1: false,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 75 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('getUnblockTime: covers non-conjMode mixed case (Case 4: periods OR limit)', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[76] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 7200, now - 3600, 7200, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    limitMins1: '60', limitPeriod1: '86400', limitOffset1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: false, rollover1: true,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 76 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });

        it('getUnblockTime: covers lockdown end time extension', () => {
            const mockSendResponse = jest.fn();
            const tabs = [];
            tabs[77] = {
                url: 'http://example.com', focused: false, loaded: true,
                clockable: false, referrer: '', keyword: null,
            };
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: {
                    timedata1: [0, 0, 0, 0, now + 7200, 0, 0, 0, 0], // lockdown for 2 hrs
                    times1: '0000-2400',
                    limitMins1: '', limitPeriod1: '',
                    days1: [true, true, true, true, true, true, true],
                    conjMode1: false, rollover1: false,
                    theme: '', customStyle: '', disableLink: false,
                },
            });
            global.handleMessage(
                { type: 'blocked' },
                { tab: { id: 77 }, url: 'moz-extension://test-id/blocked.html?1&http://example.com' },
                mockSendResponse
            );
            expect(mockSendResponse).toHaveBeenCalled();
        });
    });

    // ── applyOverride (endTime > 0) ───────────────────────────────────────────
    describe('applyOverride with endTime > 0', () => {
        it('saves override end time to storage', () => {
            browserMock.storage.local.set.mockClear();
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 0, orln: null, orlp: null, orlps: 0, orlc: 0 },
            });
            global.applyOverride(now + 3600);
            expect(browserMock.storage.local.set).toHaveBeenCalled();
            const state = global.getBackgroundState();
            expect(state.gOptions.oret).toBe(now + 3600);
        });

        it('increments override limit count when orln+orlp are set', () => {
            browserMock.storage.local.set.mockClear();
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 0, orln: '5', orlp: '86400', orlps: 0, orlc: 2 },
            });
            global.applyOverride(now + 3600);
            const state = global.getBackgroundState();
            expect(state.gOptions.orlc).toBeGreaterThan(0);
        });
    });

    // ── resetRolloverTime and discardRemainingTime ─────────────────────────────
    describe('resetRolloverTime', () => {
        it('resets rollover for the active tab set', () => {
            const tabs = [];
            tabs[600] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 999, 0, 0, 0], processActiveTabs: false },
                gTabs: tabs,
            });
            global.handleTabActivated({ tabId: 600, previousTabId: 0, windowId: 1 });
            global.handleMessage({ type: 'reset-rollover' }, { tab: { id: 600 } }, jest.fn());
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[5]).toBe(0);
        });

        it('does nothing when there is no active tab (gActiveTabId=0)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 999, 0, 0, 0] },
                gTabs: [],
            });
            global.handleTabActivated({ tabId: 0, previousTabId: 0, windowId: 1 });
            global.resetRolloverTime();
        });
    });

    describe('discardRemainingTime', () => {
        it('sets used time equal to time limit', () => {
            const tabs = [];
            tabs[601] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], limitMins1: '60', processActiveTabs: false },
                gTabs: tabs,
            });
            global.handleTabActivated({ tabId: 601, previousTabId: 0, windowId: 1 });
            global.handleMessage({ type: 'discard-time' }, { tab: { id: 601 } }, jest.fn());
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[3]).toBe(3600); // 60 min * 60
        });
    });

    // ── openExtensionPage ─────────────────────────────────────────────────────
    describe('openExtensionPage (via handleMenuClick)', () => {
        beforeEach(() => {
            browserMock.tabs.query.mockReset();
            browserMock.tabs.create.mockClear();
            browserMock.tabs.update.mockClear();
        });

        it('activates existing tab when found', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([{ id: 700 }]);
            const handleMenuClick = mockListener.addListener.mock.calls[0][0];
            handleMenuClick({ menuItemId: 'lockdown' }, {});
            await flushPromises();
            expect(browserMock.tabs.update).toHaveBeenCalledWith(700, { active: true });
        });

        it('creates new tab when none found', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            const handleMenuClick = mockListener.addListener.mock.calls[0][0];
            handleMenuClick({ menuItemId: 'override' }, {});
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('creates tab on query rejection', async () => {
            browserMock.tabs.query.mockRejectedValueOnce(new Error('fail'));
            const handleMenuClick = mockListener.addListener.mock.calls[0][0];
            handleMenuClick({ menuItemId: 'stats' }, {});
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });
    });

    // ── handleMenuClick ───────────────────────────────────────────────────────
    describe('handleMenuClick', () => {
        let handleMenuClick;
        beforeAll(() => {
            handleMenuClick = mockListener.addListener.mock.calls[0][0];
        });
        beforeEach(() => {
            browserMock.runtime.openOptionsPage = jest.fn();
            browserMock.tabs.query.mockReset();
            browserMock.tabs.query.mockResolvedValue([]);
            browserMock.tabs.create.mockClear();
        });

        it('opens options page', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            handleMenuClick({ menuItemId: 'options' }, {});
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'moz-extension://test-id/options.html' });
        });

        it('opens stats page', async () => {
            handleMenuClick({ menuItemId: 'stats' }, {});
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('adds site to block set (addSite-)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { sites1: '', blockRE1: '', allowRE1: '', referRE1: '', keywordRE1: '', matchSubdomains: false },
            });
            handleMenuClick({ menuItemId: 'addSite-1', pageUrl: 'http://newsite.com/page' }, {});
            const state = global.getBackgroundState();
            expect(state.gOptions.sites1).toContain('newsite.com');
        });

        it('adds page (with path) to block set (addPage-)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { sites1: '', blockRE1: '', allowRE1: '', referRE1: '', keywordRE1: '', matchSubdomains: false },
            });
            handleMenuClick({ menuItemId: 'addPage-1', pageUrl: 'http://newpage.com/some/path' }, {});
            const state = global.getBackgroundState();
            expect(state.gOptions.sites1).toContain('newpage.com');
        });
    });

    // ── handleCommand ─────────────────────────────────────────────────────────
    describe('handleCommand', () => {
        let handleCommand;
        beforeAll(() => {
            handleCommand = mockListener.addListener.mock.calls[1][0];
        });
        beforeEach(() => {
            browserMock.runtime.openOptionsPage = jest.fn();
            browserMock.tabs.query.mockReset();
            browserMock.tabs.query.mockResolvedValue([]);
            browserMock.tabs.create.mockClear();
        });

        it('ivb-options opens options page', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            handleCommand('ivb-options');
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'moz-extension://test-id/options.html' });
        });

        it('ivb-statistics opens stats page', async () => {
            handleCommand('ivb-statistics');
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('ivb-lockdown opens lockdown page', async () => {
            handleCommand('ivb-lockdown');
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('ivb-override opens override page', async () => {
            handleCommand('ivb-override');
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('ivb-add-sites opens add-sites page', async () => {
            handleCommand('ivb-add-sites');
            await flushPromises();
            expect(browserMock.tabs.create).toHaveBeenCalled();
        });

        it('ivb-cancel-override clears override', () => {
            browserMock.storage.local.set.mockClear();
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 9999999 },
            });
            handleCommand('ivb-cancel-override');
            expect(browserMock.storage.local.set).toHaveBeenCalled();
        });

        it('ivb-reset-rollover resets rollover time', () => {
            const tabs = [];
            tabs[800] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 999, 0, 0, 0], processActiveTabs: false },
                gTabs: tabs,
            });
            global.handleTabActivated({ tabId: 800, previousTabId: 0, windowId: 1 });
            handleCommand('ivb-reset-rollover');
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[5]).toBe(0);
        });

        it('ivb-discard-time discards remaining time', () => {
            const tabs = [];
            tabs[801] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], limitMins1: '30', processActiveTabs: false },
                gTabs: tabs,
            });
            global.handleTabActivated({ tabId: 801, previousTabId: 0, windowId: 1 });
            handleCommand('ivb-discard-time');
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[3]).toBe(1800);
        });
    });

    // ── handleMessage – remaining types ───────────────────────────────────────
    describe('handleMessage additional types', () => {
        let mockSendResponse;
        beforeEach(() => {
            mockSendResponse = jest.fn();
            browserMock.storage.local.get.mockClear();
        });

        it('"add-sites" adds sites to block set', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { sites1: '', blockRE1: '', allowRE1: '', referRE1: '', keywordRE1: '', matchSubdomains: false },
            });
            global.handleMessage(
                { type: 'add-sites', sites: 'example.com safe.net', set: 1 },
                { tab: { id: 60 } },
                mockSendResponse
            );
            const state = global.getBackgroundState();
            expect(state.gOptions.sites1).toContain('example.com');
        });

        it('"add-sites" skips lines starting with + (exceptions)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { sites1: '', blockRE1: '', allowRE1: '', referRE1: '', keywordRE1: '', matchSubdomains: false },
            });
            global.handleMessage(
                { type: 'add-sites', sites: '+exception.com normal.com', set: 1 },
                { tab: { id: 60 } },
                mockSendResponse
            );
            const state = global.getBackgroundState();
            expect(state.gOptions.sites1).not.toContain('exception.com');
            expect(state.gOptions.sites1).toContain('normal.com');
        });

        it('"delayed" calls allowBlockedPage with stored tab ID', () => {
            const tabs = [];
            tabs[60] = {
                url: 'http://example.com', focused: false, loaded: true, clockable: false, referrer: '',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0, incog: false, audible: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { delayAutoLoad1: true, delayFirst1: false, delayAllowMins1: '' },
                gDelayedTabIds: { '1|http://example.com': 60 },
            });
            global.handleMessage(
                { type: 'delayed', blockedSet: '1', blockedURL: 'http://example.com', tabId: 60 },
                { tab: { id: 60 } },
                mockSendResponse
            );
            expect(browserMock.tabs.update).toHaveBeenCalled();
        });

        it('"discard-time" calls discardRemainingTime', () => {
            const tabs = [];
            tabs[60] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], limitMins1: '60', processActiveTabs: false },
            });
            global.handleTabActivated({ tabId: 60, previousTabId: 0, windowId: 1 });
            global.handleMessage({ type: 'discard-time' }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[3]).toBe(3600);
        });

        it('"lockdown" with endTime > 0 applies lockdown', () => {
            const tabs = [];
            tabs[60] = { url: 'http://example.com' };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0] },
            });
            const endTime = Math.floor(Date.now() / 1000) + 3600;
            global.handleMessage({ type: 'lockdown', set: 1, endTime }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[4]).toBe(endTime);
        });

        it('"lockdown" with endTime=0 cancels lockdown', () => {
            const tabs = [];
            tabs[60] = { url: 'http://example.com' };
            const endTime = Math.floor(Date.now() / 1000) + 3600;
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 0, 0, 0, endTime, 0, 0, 0, 0] },
            });
            global.handleMessage({ type: 'lockdown', set: 1, endTime: 0 }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[4]).toBe(0);
        });

        it('"options" calls retrieveOptions and reorderTimeData', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...FULL_OPTIONS });
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            global.handleMessage({ type: 'options', ordering: null }, { tab: { id: 60 } }, mockSendResponse);
            await flushPromises();
            const state = global.getBackgroundState();
            expect(state.gGotOptions).toBe(true);
        });

        it('"options" with non-null ordering reorders time data', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...FULL_OPTIONS });
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { timedata1: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
            });
            global.handleMessage({ type: 'options', ordering: [null, 1] }, { tab: { id: 60 } }, mockSendResponse);
            await flushPromises();
        });

        it('"override" calls applyOverride', () => {
            browserMock.storage.local.set.mockClear();
            global.setBackgroundState({
                gGotOptions: true,
                gOptions: { oret: 0 },
            });
            const endTime = Math.floor(Date.now() / 1000) + 3600;
            global.handleMessage({ type: 'override', endTime }, { tab: { id: 60 } }, mockSendResponse);
            expect(browserMock.storage.local.set).toHaveBeenCalled();
        });

        it('"password" calls allowBlockedPage', () => {
            browserMock.tabs.update.mockClear();
            const tabs = [];
            tabs[60] = {
                url: 'http://example.com', focused: false, loaded: true, clockable: false, referrer: '',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0, incog: false, audible: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { delayFirst1: false, delayAllowMins1: '' },
            });
            global.handleMessage(
                { type: 'password', tabId: 60, blockedURL: 'http://example.com', blockedSet: '1' },
                { tab: { id: 60 } },
                mockSendResponse
            );
            expect(browserMock.tabs.update).toHaveBeenCalledWith(60, { url: 'http://example.com' });
        });

        it('"reset-rollover" calls resetRolloverTime', () => {
            const tabs = [];
            tabs[60] = {
                secsLeftSet: 1, url: 'http://example.com',
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
                referrer: '', incog: false, audible: false, focused: false, loaded: false, loadedTime: 0, clockable: false,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 0, 0, 0, 0, 500, 0, 0, 0], processActiveTabs: false },
            });
            global.handleTabActivated({ tabId: 60, previousTabId: 0, windowId: 1 });
            global.handleMessage({ type: 'reset-rollover' }, { tab: { id: 60 } }, mockSendResponse);
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[5]).toBe(0);
        });

        it('"restart" resets time data and calls sendResponse', () => {
            const tabs = [];
            tabs[60] = { url: 'http://example.com' };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: tabs,
                gOptions: { timedata1: [0, 999, 0, 0, 0, 0, 0, 0, 0] },
            });
            global.handleMessage({ type: 'restart', set: 1 }, { tab: { id: 60 } }, mockSendResponse);
            expect(mockSendResponse).toHaveBeenCalled();
            const state = global.getBackgroundState();
            expect(state.gOptions.timedata1[1]).toBe(0);
        });
    });

    // ── handleTabUpdated (status=complete) ────────────────────────────────────
    describe('handleTabUpdated status=complete', () => {
        it('updates URL when changeInfo.url is set alongside status', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            global.handleTabUpdated(900, { status: 'complete', url: 'http://newurl.com' },
                { id: 900, active: false, incognito: false, audible: false, windowId: 1, url: 'http://newurl.com' });
            const state = global.getBackgroundState();
            expect(state.gTabs[900].url).toContain('newurl.com');
        });
    });

    // ── handleTabRemoved with extension URL ───────────────────────────────────
    describe('handleTabRemoved when extension page is closed', () => {
        it('activates the previously active tab', () => {
            browserMock.tabs.update.mockClear();
            const prevTabId = 1001;
            const extTabId = 1002;
            const tabs = [];
            tabs[prevTabId] = {
                url: 'http://example.com', clockable: false, focused: false, loaded: false,
                loadedTime: 0, referrer: '', incog: false, audible: false,
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
            };
            tabs[extTabId] = {
                url: 'moz-extension://test-id/options.html', clockable: false, focused: false, loaded: false,
                loadedTime: 0, referrer: '', incog: false, audible: false,
                allowedHost: null, allowedPath: null, allowedSet: 0, allowedEndTime: 0,
            };
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: tabs,
            });
            // Activate prevTab first, then extTab — sets gPrevActiveTabId = prevTabId
            global.handleTabActivated({ tabId: prevTabId, previousTabId: 0, windowId: 1 });
            global.handleTabActivated({ tabId: extTabId, previousTabId: prevTabId, windowId: 1 });
            global.handleTabRemoved(extTabId, {});
            expect(browserMock.tabs.update).toHaveBeenCalledWith(prevTabId, { active: true });
            const state = global.getBackgroundState();
            expect(state.gTabs[extTabId]).toBeUndefined();
        });
    });

    // ── handleBeforeNavigate ──────────────────────────────────────────────────
    describe('handleBeforeNavigate', () => {
        let handleBeforeNavigate;
        beforeAll(() => {
            handleBeforeNavigate = mockListener.addListener.mock.calls[7][0];
        });

        it('ignores sub-frame navigation (frameId != 0)', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            handleBeforeNavigate({ tabId: 1100, frameId: 1, url: 'http://safe.com' });
            const state = global.getBackgroundState();
            // Tab was initialized but url not changed (frameId != 0)
            expect(state.gTabs[1100].url).toBe('about:blank');
        });

        it('processes main-frame navigation and updates tab URL', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
            });
            global.createRegExps();
            handleBeforeNavigate({ tabId: 1101, frameId: 0, url: 'http://safe.com' });
            const state = global.getBackgroundState();
            expect(state.gTabs[1101].loaded).toBe(false);
            expect(state.gTabs[1101].url).toContain('safe.com');
        });

        it('stores tabId for delayed-page navigation', () => {
            const delayedBaseURL = 'moz-extension://test-id/delayed.html';
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: { processActiveTabs: false, timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], times1: '', limitMins1: '', allFocused: false, oret: 0 },
                gTabs: [],
                gDelayedTabIds: {},
            });
            global.createRegExps();
            handleBeforeNavigate({ tabId: 1102, frameId: 0, url: `${delayedBaseURL}?1&http://example.com` });
            const state = global.getBackgroundState();
            expect(state.gDelayedTabIds['1|http://example.com']).toBe(1102);
        });

        it('blocks matching URL during before-navigate', () => {
            browserMock.tabs.update.mockClear();
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false,
                    regexpBlock1: 'beforenav\\.com',
                    regexpAllow1: '',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0],
                    times1: '0000-2400',
                    days1: [true, true, true, true, true, true, true],
                    limitMins1: '', allFocused: false,
                    blockURL1: 'moz-extension://test-id/blocked.html?$S&$U',
                    closeTab1: false, applyFilter1: false, minBlock1: '', oret: 0,
                },
                gTabs: [],
            });
            global.createRegExps();
            handleBeforeNavigate({ tabId: 1103, frameId: 0, url: 'http://beforenav.com/page' });
            expect(browserMock.tabs.update).toHaveBeenCalled();
        });

        it('returns early when gGotOptions is false', () => {
            global.setBackgroundState({ gGotOptions: false, gTabs: [] });
            handleBeforeNavigate({ tabId: 1104, frameId: 0, url: 'http://safe.com' });
            const state = global.getBackgroundState();
            // Tab is initialized but no further processing done
            expect(state.gTabs[1104]).toBeDefined();
        });
    });

    // ── handleWinFocused ──────────────────────────────────────────────────────
    describe('handleWinFocused', () => {
        it('updates focused window ID without error', () => {
            const handleWinFocused = mockListener.addListener.mock.calls[8][0];
            expect(() => handleWinFocused(42)).not.toThrow();
        });
    });

    // ── onInterval ───────────────────────────────────────────────────────────
    describe('onInterval', () => {
        beforeEach(() => {
            browserMock.tabs.query.mockReset();
            browserMock.tabs.query.mockResolvedValue([]);
            browserMock.storage.local.get.mockReset();
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValue({ ...FULL_OPTIONS });
        });

        it('calls retrieveOptions when gGotOptions is false', async () => {
            global.setBackgroundState({ gGotOptions: false, gOptions: {}, gNumSets: 1 });
            jest.advanceTimersByTime(1001);
            await flushPromises();
            expect(browserMock.storage.local.get).toHaveBeenCalled();
        });

        it('calls processTabs when gGotOptions is true', async () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false, saveSecs: '100',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], oret: 0, allFocused: false,
                },
                gTabs: [],
            });
            global.createRegExps();
            jest.advanceTimersByTime(1001);
            await flushPromises();
            expect(browserMock.tabs.query).toHaveBeenCalled();
        });

        it('cleans up expired gDelayAllowances entries', () => {
            const now = Math.floor(Date.now() / 1000);
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false, saveSecs: '100',
                    timedata1: [0, 0, 0, 0, 0, 0, 0, 0, 0], oret: 0, allFocused: false,
                },
                gTabs: [],
                gDelayAllowances: [
                    { host: 'expired.com', set: 1, expiresAt: now - 100 },
                    { host: 'valid.com', set: 1, expiresAt: now + 100 },
                ],
            });
            global.createRegExps();
            jest.advanceTimersByTime(1001);
            const state = global.getBackgroundState();
            expect(state.gDelayAllowances.some(a => a.host === 'expired.com')).toBe(false);
            expect(state.gDelayAllowances.some(a => a.host === 'valid.com')).toBe(true);
        });

        it('saves time data when gSaveSecsCount reaches saveSecs', async () => {
            browserMock.storage.local.set.mockClear();
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1,
                gOptions: {
                    processActiveTabs: false, saveSecs: '1',
                    timedata1: [0, 999, 0, 0, 0, 0, 0, 0, 0], oret: 0, allFocused: false,
                },
                gTabs: [],
            });
            global.createRegExps();
            jest.advanceTimersByTime(1001);
            await flushPromises();
            // saveTimeData should have been called (data differs from gSavedTimeData default)
            expect(browserMock.storage.local.set).toHaveBeenCalled();
        });
    });

    // ── onAlarm ───────────────────────────────────────────────────────────────
    describe('onAlarm', () => {
        it('handles alarm events without throwing', () => {
            const onAlarm = mockListener.addListener.mock.calls[9][0];
            expect(() => onAlarm({ name: 'Alarm1' })).not.toThrow();
        });
    });

    // ── allowBlockedPage edge cases ───────────────────────────────────────────
    describe('allowBlockedPage edge cases', () => {
        it('returns early when set is out of range', () => {
            global.setBackgroundState({ gGotOptions: true, gNumSets: 1, gTabs: [] });
            expect(() => global.allowBlockedPage(42, 'http://example.com', 5, false)).not.toThrow();
        });

        it('calculates allowedEndTime when delayAllowMins is set', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: [],
                gOptions: { delayFirst1: false, delayAllowMins1: '30' },
            });
            global.allowBlockedPage(42, 'http://example.com', '1', false);
            const state = global.getBackgroundState();
            expect(state.gTabs[42].allowedEndTime).toBeGreaterThan(0);
        });

        it('sets allowedHost=null when delayFirstMode=1', () => {
            global.setBackgroundState({
                gGotOptions: true, gNumSets: 1, gTabs: [],
                gOptions: { delayFirst1: true, delayFirstMode1: '1', delayAllowMins1: '' },
            });
            global.allowBlockedPage(42, 'http://example.com', '1', false);
            const state = global.getBackgroundState();
            expect(state.gTabs[42].allowedHost).toBeNull();
        });
    });
});
