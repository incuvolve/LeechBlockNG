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

// Set up DOM with 3 block sets so initForm(3) and refreshPage(numSets=2) can
// access blockSetLabel2/3 via getElement() (the jQuery mock doesn't touch the DOM).
document.body.innerHTML = `
  <div id="form">
    <div id="blockSets">
      <input id="blockSet1" type="checkbox">
      <label id="blockSetLabel1" for="blockSet1">Block Set 1</label>
      <input id="blockSet2" type="checkbox">
      <label id="blockSetLabel2" for="blockSet2">Block Set 2</label>
      <input id="blockSet3" type="checkbox">
      <label id="blockSetLabel3" for="blockSet3">Block Set 3</label>
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
    let consoleWarnSpy;

    beforeAll(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(() => {
        consoleWarnSpy.mockRestore();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Restore default mock implementations after clearAllMocks depletes once-queues.
        browserMock.storage.local.get.mockImplementation(() =>
            Promise.resolve({ sync: false, numSets: "1" })
        );
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

    describe('initForm', () => {
        it('sets up jQuery UI buttons without error for 1 set', () => {
            expect(() => global.initForm(1)).not.toThrow();
            expect(mockJQuery.button).toHaveBeenCalled();
            expect(mockJQuery.click).toHaveBeenCalled();
        });

        it('appends extra block-set HTML and calls i18n for each set when numSets=3', () => {
            global.initForm(3);
            // One append per extra set (sets 2 and 3)
            expect(mockJQuery.append).toHaveBeenCalledTimes(2);
            // i18n getMessage called once per set label (sets 1, 2, 3)
            expect(browserMock.i18n.getMessage).toHaveBeenCalledWith('lockdownSitesInBlockSet');
            expect(browserMock.i18n.getMessage).toHaveBeenCalledTimes(3);
        });
    });

    describe('initializePage / refreshPage', () => {
        it('should fetch options from storage', async () => {
            global.initializePage();
            await new Promise(r => setTimeout(r, 50));
            expect(browserMock.storage.local.get).toHaveBeenCalled();
        });

        it('populates form fields when sync is false and options contain values', async () => {
            // First call: get("sync") → {sync: false}
            // Second call: gStorage.get() → full options
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    sync: false,
                    numSets: "2",
                    theme: "",
                    clockOffset: "",
                    lockdownHours: "2",
                    lockdownMins: "30",
                    lockdown1: true,
                    setName1: "Work",
                    lockdown2: false,
                    setName2: ""
                });

            global.initializePage();
            await new Promise(r => setTimeout(r, 50));

            expect(browserMock.storage.local.get).toHaveBeenCalledTimes(2);
            expect(document.getElementById('hours').value).toBe('2');
            expect(document.getElementById('mins').value).toBe('30');
            expect(document.getElementById('blockSet1').checked).toBe(true);
        });

        it('calls browser.storage.sync.get when sync option is true', async () => {
            browserMock.storage.local.get.mockResolvedValueOnce({ sync: true });
            browserMock.storage.sync.get.mockResolvedValueOnce({
                sync: true,
                numSets: "1",
                theme: "",
                clockOffset: ""
            });

            global.initializePage();
            await new Promise(r => setTimeout(r, 50));

            expect(browserMock.storage.sync.get).toHaveBeenCalled();
        });

        it('opens error dialog when storage.local.get rejects', async () => {
            browserMock.storage.local.get.mockRejectedValueOnce(new Error('storage failure'));

            global.initializePage();
            await new Promise(r => setTimeout(r, 50));

            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });
    });

    describe('onActivate', () => {
        beforeEach(async () => {
            // Reset gStorage to browser.storage.local by running a sync:false refresh
            // before each test so gStorage is predictable regardless of prior test order.
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ sync: false, numSets: "1", theme: "", clockOffset: "" });
            global.initializePage();
            await new Promise(r => setTimeout(r, 50));

            // Reset DOM input state
            document.getElementById('hours').value = '';
            document.getElementById('mins').value = '';
            document.getElementById('blockSet1').checked = false;

            // Clear mock records from the setup above
            jest.clearAllMocks();
            browserMock.storage.local.get.mockImplementation(() =>
                Promise.resolve({ sync: false, numSets: "1" })
            );
        });

        it('sends lockdown message, saves options, and hides form on valid input', () => {
            document.getElementById('hours').value = '1';
            document.getElementById('mins').value = '30';
            document.getElementById('blockSet1').checked = true;

            global.onActivate();

            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'lockdown', set: 1 })
            );
            expect(browserMock.storage.local.set).toHaveBeenCalled();
            expect(mockJQuery.hide).toHaveBeenCalled();
        });

        it('opens alertNoDuration dialog and does not send message when duration is zero', () => {
            document.getElementById('hours').value = '0';
            document.getElementById('mins').value = '0';
            document.getElementById('blockSet1').checked = true;

            global.onActivate();

            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
            expect(browserMock.runtime.sendMessage).not.toHaveBeenCalled();
        });

        it('opens alertNoSets dialog and does not save options when no sets are selected', () => {
            document.getElementById('hours').value = '1';
            document.getElementById('mins').value = '0';
            document.getElementById('blockSet1').checked = false;

            global.onActivate();

            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
            expect(browserMock.storage.local.set).not.toHaveBeenCalled();
        });
    });
});
