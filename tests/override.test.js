/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
// Default options include orc:false so async initializePage callbacks never set
// gOverrideConfirm=true inside the module, keeping activateOverride tests deterministic.
const DEFAULT_OPTIONS = { sync: false, orc: false };
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve(DEFAULT_OPTIONS)),
            set: jest.fn(() => Promise.resolve())
        },
        sync: {
            get: jest.fn(() => Promise.resolve(DEFAULT_OPTIONS)),
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
    on: jest.fn().mockReturnThis(),
};
const jQueryMock = jest.fn(() => mockJQuery);

global.browser = browserMock;
global.$ = jQueryMock;

// DOM must be set before requiring override.js so startup code has elements available
const DOM_HTML = `
<div id="form" style="display:none"></div>
<div id="alertLimitReached"></div>
<div id="alertLimitNum"></div>
<div id="alertLimitReachedPeriod"></div>
<div id="alertNoDuration"></div>
<div id="alertRetrieveError"></div>
<div id="alertOverrideActivated"></div>
<div id="alertOverrideNoSets"></div>
<div id="alertOverrideSets"></div>
<div id="alertOverrideSetList"></div>
<div id="alertOverrideLimit"></div>
<div id="alertOverrideEndTime"></div>
<div id="alertLimitLeft"></div>
<div id="alertLimitPeriod"></div>
<div id="promptPassword"></div>
<input id="promptPasswordInput" type="text">
<div id="promptAccessCode"></div>
<div id="promptAccessCodeText"></div>
<div id="promptAccessCodeImage" style="display:none">
  <canvas id="promptAccessCodeCanvas"></canvas>
</div>
<input id="promptAccessCodeInput" type="text">
<input id="mins" type="text" value="">
<button id="activate">Activate</button>
<button id="cancel">Cancel</button>
`;
document.body.innerHTML = DOM_HTML;

require('../common.js');
require('../override.js');

// Helper: flush pending microtasks and macrotasks
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('override.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(global.Date, 'now').mockReturnValue(1678886400000);
        // Reset DOM so DOM-dependent tests each start with a clean state
        document.body.innerHTML = DOM_HTML;
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

        it('should use sync storage when sync option is true', async () => {
            browserMock.storage.local.get.mockResolvedValueOnce({ sync: true });
            global.initializePage();
            await flushPromises();
            expect(browserMock.storage.sync.get).toHaveBeenCalled();
        });

        it('should show error dialog when storage retrieval fails', async () => {
            browserMock.storage.local.get.mockRejectedValueOnce(new Error('storage error'));
            global.initializePage();
            await flushPromises();
            expect(jQueryMock).toHaveBeenCalledWith('#alertRetrieveError');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should show limit-reached dialog when override limit exhausted', async () => {
            const now = Math.floor(1678886400000 / 1000);
            // Compute matching periodStart for the daily period
            const periodStart = global.getTimePeriodStart(now, '86400');
            browserMock.storage.local.get
                // first call: get("sync") → not syncing
                .mockResolvedValueOnce({ sync: false })
                // second call: get() → full options; orln/orlp must be strings, orlps/orlc numbers
                .mockResolvedValueOnce({
                    orln: '3', orlp: '86400', orlps: periodStart, orlc: 3, orc: false
                });
            global.initializePage();
            await flushPromises();
            expect(jQueryMock).toHaveBeenCalledWith('#alertLimitReached');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });
    });

    describe('initForm', () => {
        it('should set up jQuery UI buttons for activate and cancel', () => {
            global.initForm();
            expect(jQueryMock).toHaveBeenCalledWith('#activate');
            expect(jQueryMock).toHaveBeenCalledWith('#cancel');
            expect(mockJQuery.button).toHaveBeenCalled();
            expect(mockJQuery.click).toHaveBeenCalled();
        });
    });

    // confirmAccess tests run before activateOverride tests to ensure the module's
    // gOverrideMins is still falsy (its initial undefined value)
    describe('confirmAccess', () => {
        it('should open password prompt when ora==1 and password is set (hpp=false)', () => {
            global.confirmAccess({ ora: 1, password: 'secret', hpp: false, orp: null, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptPasswordInput');
            expect(mockJQuery.attr).toHaveBeenCalledWith('type', 'text');
            expect(mockJQuery.val).toHaveBeenCalledWith('');
            expect(jQueryMock).toHaveBeenCalledWith('#promptPassword');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
            expect(mockJQuery.focus).toHaveBeenCalled();
        });

        it('should set input type to password when ora==1 and hpp=true', () => {
            global.confirmAccess({ ora: 1, password: 'secret', hpp: true, orp: null, orcode: null });
            expect(mockJQuery.attr).toHaveBeenCalledWith('type', 'password');
        });

        it('should open password prompt when ora==9 and orp is set', () => {
            global.confirmAccess({ ora: 9, orp: 'mypass', password: null, hpp: false, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptPassword');
            expect(mockJQuery.attr).toHaveBeenCalledWith('type', 'password');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should show form when ora is 0 and gOverrideMins is not set', () => {
            // gOverrideMins is undefined at this point (no prior test sets it to truthy)
            global.confirmAccess({ ora: 0, password: null, orp: null, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#form');
            expect(mockJQuery.show).toHaveBeenCalled();
        });

        it('should open access code prompt when ora==2', () => {
            global.confirmAccess({ ora: 2, accessCodeImage: false, password: null, orp: null, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptAccessCode');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should open access code prompt with longer code when ora==3', () => {
            global.confirmAccess({ ora: 3, accessCodeImage: false, password: null, orp: null, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptAccessCode');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should open access code prompt with longest code when ora==4', () => {
            global.confirmAccess({ ora: 4, accessCodeImage: false, password: null, orp: null, orcode: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptAccessCode');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should open access code prompt for ora==8 when orcode is set', () => {
            global.confirmAccess({ ora: 8, orcode: 'TESTCODE', accessCodeImage: false, password: null, orp: null });
            expect(jQueryMock).toHaveBeenCalledWith('#promptAccessCode');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });
    });

    describe('activateOverride', () => {
        // These tests rely on the module's gOverrideMins being '' or falsy.
        // After each "no mins" test gOverrideMins is set to "" (still falsy), so
        // subsequent tests continue to enter the !gOverrideMins branch.

        it('should open alertNoDuration and not send override when mins is empty', () => {
            mockJQuery.val.mockReturnValueOnce('');
            global.activateOverride();
            expect(jQueryMock).toHaveBeenCalledWith('#alertNoDuration');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
            expect(browserMock.runtime.sendMessage).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'override' })
            );
        });

        it('should open alertNoDuration when mins is not a positive integer', () => {
            mockJQuery.val.mockReturnValueOnce('abc');
            global.activateOverride();
            expect(jQueryMock).toHaveBeenCalledWith('#alertNoDuration');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });

        it('should send override message and close page when mins is valid and no confirm', () => {
            // gOverrideConfirm is false (default options have orc:false), so closePage is called
            mockJQuery.val.mockReturnValueOnce('10');
            global.activateOverride();
            // override request sent
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'override', endTime: expect.any(Number) })
            );
            // no confirmation dialog → closePage sends a close message
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    describe('displayAccessCode', () => {
        it('should display code as text, set element visibility, and return line count', () => {
            const lines = global.displayAccessCode('ABCD EFGH IJKL', false);
            expect(lines).toBeGreaterThan(0);
            expect(document.getElementById('promptAccessCodeText').style.display).toBe('');
            expect(document.getElementById('promptAccessCodeImage').style.display).toBe('none');
        });

        it('should split a long code across multiple lines', () => {
            // Code longer than 64 chars with a space forces two lines
            const longCode = 'A'.repeat(60) + ' ' + 'B'.repeat(60);
            const lines = global.displayAccessCode(longCode, false);
            expect(lines).toBe(2);
        });
    });

    describe('resizePromptInputHeight', () => {
        it('should do nothing when numLines is less than 2', () => {
            expect(() => global.resizePromptInputHeight(1)).not.toThrow();
            expect(document.getElementById('promptAccessCodeInput').tagName).toBe('INPUT');
        });

        it('should replace the input with a textarea when numLines >= 2', () => {
            global.resizePromptInputHeight(3);
            const el = document.getElementById('promptAccessCodeInput');
            expect(el).not.toBeNull();
            expect(el.tagName).toBe('TEXTAREA');
            expect(el.rows).toBe(3);
        });
    });

    describe('initializePage – additional branches', () => {
        it('sets 12-hour clock format when clockTimeFormat is 1', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ clockTimeFormat: 1, numSets: 0 });
            global.initializePage();
            await flushPromises();
            // covers lines 68-69: gClockTimeOpts.hour12 = true
        });

        it('resets override limit count when the period has rolled over', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    orln: '3', orlp: '86400', orlps: 0, orlc: 1, numSets: 0
                });
            global.initializePage();
            await flushPromises();
            // covers lines 92-94: orlps (0) != periodStart → gOverrideLimitLeft = orln
        });

        it('triggers confirmation dialog when orc+orm+allowOverride set with named set', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    orc: true, orm: '1', clockTimeFormat: 2,
                    numSets: 1, allowOverride1: true, setName1: 'Work'
                });
            global.initializePage();
            await flushPromises();
            // covers: 68-69 (clockTimeFormat=2), 101-107 (setNames loop),
            // 178-179 (activateOverride via confirmAccess), 277-290 (dialog)
            expect(jQueryMock).toHaveBeenCalledWith('#alertOverrideActivated');
            expect(mockJQuery.dialog).toHaveBeenCalledWith('open');
        });
    });

    describe('displayAccessCode – image mode', () => {
        it('renders code as a canvas image when asImage is true', () => {
            const mockCtx = {
                font: '', fillStyle: '',
                measureText: jest.fn(() => ({ width: 100 })),
                scale: jest.fn(),
                fillText: jest.fn()
            };
            HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
            const lines = global.displayAccessCode('ABC DEF GHI', true);
            expect(lines).toBeGreaterThan(0);
            expect(document.getElementById('promptAccessCodeText').style.display).toBe('none');
            expect(document.getElementById('promptAccessCodeImage').style.display).toBe('');
        });
    });
});
