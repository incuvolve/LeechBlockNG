/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ sync: false })),
            set: jest.fn(() => Promise.resolve())
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ sync: true })),
            set: jest.fn(() => Promise.resolve())
        }
    },
    runtime: {
        sendMessage: jest.fn()
    }
};

const mockJQuery = {
    html: jest.fn(function(content) {
        if (content === undefined) return "<div></div>";
        return this;
    }),
    val: jest.fn().mockReturnThis(),
    button: jest.fn().mockReturnThis(),
    click: jest.fn().mockReturnThis(),
    keydown: jest.fn().mockReturnThis(),
    dialog: jest.fn().mockReturnThis(),
    show: jest.fn().mockReturnThis(),
    effect: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    focus: jest.fn().mockReturnThis(),
    attr: jest.fn().mockReturnThis(),
    hide: jest.fn().mockReturnThis(),
};
const jQueryMock = jest.fn(() => mockJQuery);

global.browser = browserMock;
global.$ = jQueryMock;

require('../common.js');
require('../override.js');

describe('override.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(global.Date, 'now').mockReturnValue(1678886400000);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('closePage', () => {
        it('should send a message to close the page', () => {
            global.closePage();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    describe('focusMins', () => {
        it('should focus the mins input field', () => {
            global.focusMins();
            expect(mockJQuery.focus).toHaveBeenCalledTimes(1);
        });
    });

    describe('initializePage', () => {
        it('should fetch options from storage', () => {
            global.initializePage();
            expect(browserMock.storage.local.get).toHaveBeenCalled();
        });
    });
});