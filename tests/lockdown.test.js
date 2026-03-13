/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API — must be set before require('../lockdown.js')
// because lockdown.js runs `var gStorage = browser.storage.local` at module load.
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ sync: false, numSets: "1" })),
            set: jest.fn(() => Promise.resolve())
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ sync: true, numSets: "1" })),
            set: jest.fn(() => Promise.resolve())
        }
    },
    runtime: {
        sendMessage: jest.fn()
    },
    i18n: {
        getMessage: jest.fn((key) => key)
    }
};

const mockJQuery = {
    html: jest.fn(function(content) {
        if (content === undefined) return "<div>Block Set 1</div>";
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
    hide: jest.fn().mockReturnThis(),
};
const jQueryMock = jest.fn(() => mockJQuery);

global.browser = browserMock;
global.$ = jQueryMock;

// Set up minimal DOM needed by initForm (called when DOMContentLoaded fires or
// storage promise resolves after refreshPage is triggered).
document.body.innerHTML = `
  <div id="form">
    <div id="blockSets">
      <input id="blockSet1" type="checkbox">
      <label id="blockSetLabel1" for="blockSet1">Block Set 1</label>
    </div>
    <input id="hours" type="text">
    <input id="mins" type="text">
    <button id="activate">Activate</button>
    <button id="cancel">Cancel</button>
  </div>
  <div id="alerts">
    <div id="alertRetrieveError"></div>
    <div id="alertNoDuration"></div>
    <div id="alertNoSets"></div>
  </div>
`;

require('../common.js');
require('../lockdown.js');

describe('lockdown.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('closePage', () => {
        it('should send a message to close the page', () => {
            global.closePage();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    describe('onCancel', () => {
        it('should close the page when called', () => {
            global.onCancel();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    describe('initializePage', () => {
        it('should fetch options from storage', async () => {
            global.initializePage();
            await new Promise(r => setTimeout(r, 50));
            expect(browserMock.storage.local.get).toHaveBeenCalled();
        });
    });
});