/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ numSets: "2", setName1: "Set One", setName2: "Set Two", sync: false, theme: "default" }))
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ numSets: "2", setName1: "Set One", setName2: "Set Two", sync: true, theme: "default" }))
        }
    },
    runtime: {
        sendMessage: jest.fn()
    }
};

// Mock jQuery
const mockJQuery = {
    val: jest.fn().mockReturnThis(),
    button: jest.fn().mockReturnThis(),
    click: jest.fn().mockReturnThis(),
    keydown: jest.fn().mockReturnThis(),
    dialog: jest.fn().mockReturnThis(),
    show: jest.fn().mockReturnThis(),
    effect: jest.fn().mockReturnThis(),
};
const jQueryMock = jest.fn(() => mockJQuery);

global.browser = browserMock;
global.$ = jQueryMock;
global.alert = jest.fn();

require('../common.js');
require('../diagnostics.js');

describe('diagnostics.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockJQuery.val.mockReturnValue('');
        global.gOptions = null;
        global.alert.mockClear();
    });

    describe('testURL', () => {
        it('should return if gOptions is null', () => {
            global.gOptions = null;
            expect(() => global.testURL()).not.toThrow();
            expect(mockJQuery.val).not.toHaveBeenCalled();
        });

        it('should show alert for bad URL format', () => {
            global.gOptions = { numSets: "1" };
            mockJQuery.val.mockReturnValueOnce('bad-url');
            jest.spyOn(global, 'getParsedURL').mockReturnValue({ page: null });

            global.testURL();

            expect(mockJQuery.val).toHaveBeenCalledWith();
            expect(global.getParsedURL).toHaveBeenCalledWith('bad-url');
            expect(global.alert).toHaveBeenCalledWith(
                "Please enter the URL in the correct format (as a fully specified URL)."
            );
        });

        it('should generate results for valid URL', () => {
            global.gOptions = {
                numSets: "1",
                setName1: "Test Set",
                regexpBlock1: "example\\.com",
                regexpAllow1: "google\\.com",
                referRE1: "referrer\\.com",
            };
            mockJQuery.val.mockReturnValueOnce('http://www.example.com');
            jest.spyOn(global, 'getParsedURL').mockReturnValue({ page: 'http://www.example.com' });

            global.testURL();

            expect(mockJQuery.val).toHaveBeenCalledWith();
            expect(global.getParsedURL).toHaveBeenCalledWith('http://www.example.com');
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('====== Block Set 1 (Test Set)'));
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('BLOCK: example.com'));
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('ALLOW: -'));
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('REFER: -'));
        });

        it('should generate results for valid URL with no matches', () => {
            global.gOptions = {
                numSets: "1",
                setName1: "Test Set",
                regexpBlock1: "nomatch\\.com",
                regexpAllow1: "nomatch\\.com",
                referRE1: "nomatch\\.com",
            };
            mockJQuery.val.mockReturnValueOnce('http://www.example.com');
            jest.spyOn(global, 'getParsedURL').mockReturnValue({ page: 'http://www.example.com' });

            global.testURL();

            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('BLOCK: -'));
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('ALLOW: -'));
            expect(mockJQuery.val).toHaveBeenCalledWith(expect.stringContaining('REFER: -'));
        });
    });

    describe('initForm', () => {
        it('should initialize jQuery UI widgets and clear fields', () => {
            expect(() => global.initForm()).not.toThrow();
            expect(mockJQuery.click).toHaveBeenCalled();
            expect(mockJQuery.val).toHaveBeenCalledWith('');
        });
    });

    describe('initializePage', () => {
        it('should fetch options and initialize form', async () => {
            expect(() => global.initializePage()).not.toThrow();
            expect(browserMock.storage.local.get).toHaveBeenCalled();
        });
    });
});