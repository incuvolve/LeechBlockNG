/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ theme: "default" }))
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ theme: "default" }))
        }
    },
    runtime: {
        openOptionsPage: jest.fn(),
        getURL: jest.fn((url) => `chrome-extension://test/${url}`),
        sendMessage: jest.fn()
    },
    tabs: {
        query: jest.fn(() => Promise.resolve([])),
        update: jest.fn(),
        create: jest.fn()
    }
};

global.browser = browserMock;
global.localize = jest.fn();

// Create the DOM elements that popup.js queries at top level
['options', 'lockdown', 'override', 'stats', 'addSites',
 'cancelOverride', 'resetRollover', 'discardTime', 'onlineSupport',
 'themeLink'].forEach((id) => {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
});

// Mock window.close
const windowCloseSpy = jest.spyOn(global.window, 'close').mockImplementation(() => {});

require('../popup.js');

describe('popup.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        windowCloseSpy.mockImplementation(() => {});
    });

    describe('cancelOverride', () => {
        it('should send an override message and close the window', () => {
            global.cancelOverride();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'override', endTime: 0 });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('resetRollover', () => {
        it('should send a reset-rollover message and close the window', () => {
            global.resetRollover();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'reset-rollover' });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('discardTime', () => {
        it('should send a discard-time message and close the window', () => {
            global.discardTime();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'discard-time' });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('openOptions', () => {
      it('should open options page and close window', async () => {
          browserMock.tabs.query.mockResolvedValueOnce([]);
          await global.openOptions();
          expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/options.html' });
          expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('openExtensionPage', () => {
        it('should create new tab when no existing tab found', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            await global.openExtensionPage('test.html');
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/test.html' });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });

        it('should activate existing tab when found', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([{ id: 123 }]);
            await global.openExtensionPage('test.html');
            expect(browserMock.tabs.update).toHaveBeenCalledWith(123, { active: true });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('openLockdown', () => {
        it('should open lockdown.html', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            await global.openLockdown();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/lockdown.html' });
        });
    });

    describe('openOverride', () => {
        it('should open override.html', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            await global.openOverride();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/override.html' });
        });
    });

    describe('openStats', () => {
        it('should open stats.html', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            await global.openStats();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/stats.html' });
        });
    });

    describe('addSites', () => {
        it('should open add-sites.html', async () => {
            browserMock.tabs.query.mockResolvedValueOnce([]);
            await global.addSites();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://test/add-sites.html' });
        });
    });

    describe('openOnlineSupport', () => {
        it('should open the support URL and close window', () => {
            global.openOnlineSupport();
            expect(browserMock.tabs.create).toHaveBeenCalledWith({ url: 'https://www.incuvolve.de/ivblock/support/' });
            expect(windowCloseSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('initializePage', () => {
        it('should fetch theme from local storage and apply it', async () => {
            await global.initializePage();
            expect(browserMock.storage.local.get).toHaveBeenCalledWith('sync');
        });
    });
});
