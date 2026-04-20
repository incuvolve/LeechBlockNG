/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ sync: false, numSets: "2", setName1: "Set One", setName2: "Set Two" })),
            set: jest.fn(() => Promise.resolve()),
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ sync: true, numSets: "2", setName1: "Set One", setName2: "Set Two" })),
            set: jest.fn(() => Promise.resolve()),
        },
    },
    i18n: {
        getMessage: jest.fn((key) => key),
    },
    runtime: {
        sendMessage: jest.fn(),
        getURL: jest.fn((url) => `moz-extension://test/${url}`),
    },
    tabs: {
        remove: jest.fn(),
    },
};

const mockJQuery = {
    html: jest.fn().mockReturnThis(),
    val: jest.fn().mockReturnThis(),
    button: jest.fn().mockReturnThis(),
    click: jest.fn().mockReturnThis(),
    keydown: jest.fn().mockReturnThis(),
    dialog: jest.fn().mockReturnThis(),
    show: jest.fn().mockReturnThis(),
    hide: jest.fn().mockReturnThis(),
    effect: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    focus: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
};
const jQueryMock = jest.fn(() => mockJQuery);

global.browser = browserMock;
global.$ = jQueryMock;

require('../common.js');
require('../add-sites.js');

describe('add-sites.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('onCancel / closePage', () => {
        it('should send a close message when cancel is called', () => {
            global.onCancel();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });

        it('closePage should send a close message', () => {
            global.closePage();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    describe('refreshPage', () => {
        it('should fetch options from storage', () => {
            global.refreshPage();
            expect(browserMock.storage.local.get).toHaveBeenCalledWith('sync');
        });
    });

    describe('onAddSites', () => {
        it('should send add-sites and close messages when valid sites are entered', async () => {
            // Set up a mock getElementById that returns inputs with values
            jest.spyOn(document, 'getElementById').mockImplementation((id) => {
                if (id === 'sites') return { value: 'site1.com\nsite2.com' };
                if (id === 'blockSet') return { value: '1' };
                return null;
            });

            global.onAddSites();

            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'add-sites' })
            );
        });
    });
});