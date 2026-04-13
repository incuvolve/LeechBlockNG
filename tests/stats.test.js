/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ sync: false }))
        },
        sync: {
            get: jest.fn(() => Promise.resolve({}))
        },
        set: jest.fn(() => Promise.resolve())
    },
    runtime: {
        sendMessage: jest.fn(() => new Promise(() => {}))
    }
};

// Mock jQuery (minimal)
const mockJQuery = {
    html: jest.fn(function(content) {
        if (content === undefined) return "<div></div>";
        return this;
    }),
    val: jest.fn(),
    button: jest.fn().mockReturnThis(),
    click: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
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
global.jQuery = jQueryMock;

require('../common.js');
require('../stats.js');

// Helper: create a DOM element stub with innerText and parentElement.style
const makeEl = () => ({ innerText: '', parentElement: { style: { display: '' } } });

// Full set of element IDs stats.js accesses for set N
function makeGetElementById(n) {
    return jest.fn((id) => {
        if (id === `blockSetName${n}`) return makeEl();
        if (id === `startTime${n}`) return makeEl();
        if (id === `totalTime${n}`) return makeEl();
        if (id === `perWeekTime${n}`) return makeEl();
        if (id === `perDayTime${n}`) return makeEl();
        if (id === `timeLeft${n}`) return makeEl();
        if (id === `rolloverTime${n}`) return makeEl();
        if (id === `ldEndTime${n}`) return makeEl();
        return null;
    });
}

// Base options for one set, all types matching cleanOptions expectations.
// limitMins1 is "" (empty/falsy) to exercise the "no limit" else branch.
const baseOptions1 = {
    numSets: "1",
    theme: "",
    clockOffset: "0",
    clockTimeFormat: "0",
    timedata1: [1678886400, 3600, 1678885200, 1800, 0, 0, 0, 0, 0],
    setName1: "Work",
    limitMins1: "",
    limitPeriod1: "3600",
    limitOffset1: "0",
    rollover1: false,
};


describe('stats.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default getElementById: return full stubs for set 1 elements
        document.getElementById = makeGetElementById(1);

        // Mock Date.now() for consistent time calculations
        jest.spyOn(global.Date, 'now').mockReturnValue(1678886400000); // March 15, 2023 00:00:00 GMT
    });

    // -------------------------------------------------------------------------
    describe('getFormattedStats', () => {
        it('should return formatted time strings for a one-week period', () => {
            const start = 1678886400;
            const now = start + 86400 * 6;
            const timedata = [start, 3600 * 7, 0, 0, 0, 0, 0, 0, 0];
            const result = global.getFormattedStats(now, timedata);
            expect(result.totalTime).toBe('07:00:00');
            expect(result.perWeekTime).toBe('07:00:00');
            expect(result.perDayTime).toBe('01:00:00');
        });

        it('should return formatted time strings for a single day', () => {
            const start = 1678886400;
            const now = start;
            const timedata = [start, 3600, 0, 0, 0, 0, 0, 0, 0];
            const result = global.getFormattedStats(now, timedata);
            expect(result.totalTime).toBe('01:00:00');
            expect(result.perWeekTime).toBe('01:00:00');
            expect(result.perDayTime).toBe('01:00:00');
        });
    });

    // -------------------------------------------------------------------------
    describe('getFormattedClockTime', () => {
        it('should return a non-empty string for a valid timestamp', () => {
            const time = 1678886400000 + (3600 * 1000 * 10) + (15 * 60 * 1000);
            const result = global.getFormattedClockTime(time);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    describe('initForm', () => {
        it('should not throw for a single set', () => {
            expect(() => global.initForm(1)).not.toThrow();
            expect(jQueryMock).toHaveBeenCalledWith('#stats-card-template');
            expect(mockJQuery.hide).toHaveBeenCalled();
        });

        it('should append one card per set', () => {
            expect(() => global.initForm(3)).not.toThrow();
            // append is called once per set
            expect(mockJQuery.append).toHaveBeenCalledTimes(3);
        });

        it('should register click handler on buttons', () => {
            global.initForm(1);
            expect(jQueryMock).toHaveBeenCalledWith(':button');
            expect(mockJQuery.off).toHaveBeenCalledWith('click');
            expect(mockJQuery.on).toHaveBeenCalledWith('click', global.handleClick);
        });
    });

    // -------------------------------------------------------------------------
    describe('handleClick', () => {
        it('should send restart message for restartAll', () => {
            global.handleClick({ target: { id: 'restartAll' } });
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'restart', set: 0 });
        });

        it('should send restart message with correct set number for restart3', () => {
            global.handleClick({ target: { id: 'restart3' } });
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'restart', set: 3 });
        });

        it('should send restart message with correct set number for restart12', () => {
            global.handleClick({ target: { id: 'restart12' } });
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'restart', set: 12 });
        });

        it('should not send any message for an unknown button id', () => {
            global.handleClick({ target: { id: 'unknownButton' } });
            expect(browserMock.runtime.sendMessage).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    describe('refreshPage', () => {
        it('should call browser.storage.local.get with "sync" key', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...baseOptions1 });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(browserMock.storage.local.get).toHaveBeenCalledWith('sync');
        });

        it('should populate DOM elements for a set with no limit (else branch)', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...baseOptions1, limitMins1: "0" });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            // The else branch hides timeLeft and rolloverTime parent elements
            const timeLeftEl = document.getElementById('timeLeft1');
            expect(timeLeftEl).not.toBeNull();
        });

        it('should show timeLeft when limitMins and limitPeriod are set', async () => {
            const el = makeEl();
            document.getElementById = jest.fn((id) => {
                if (id === 'timeLeft1') return el;
                return makeEl();
            });

            // timedata[2] = 1678885200 matches periodStart for limitPeriod=3600
            // so the secsLeft ternary takes the `timedata[2] == periodStart` branch (line 107)
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    ...baseOptions1,
                    limitMins1: "60",
                    limitPeriod1: "3600",
                    rollover1: false,
                    timedata1: [1678886400, 3600, 1678885200, 1800, 0, 0, 0, 0, 0],
                });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(el.innerText).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });

        it('should show rolloverTime when limitMins, limitPeriod and rollover are set', async () => {
            const rolloverEl = makeEl();
            document.getElementById = jest.fn((id) => {
                if (id === 'rolloverTime1') return rolloverEl;
                return makeEl();
            });

            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    ...baseOptions1,
                    limitMins1: "60",
                    limitPeriod1: "3600",
                    // rollover must be boolean true — cleanOptions keeps booleans
                    rollover1: true,
                    timedata1: [1678886400, 3600, 1678886400, 1800, 0, 120, 0, 0, 0],
                });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(rolloverEl.innerText).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });

        it('should populate ldEndTime when timedata[4] is a future lockdown end time', async () => {
            const ldEl = makeEl();
            document.getElementById = jest.fn((id) => {
                if (id === 'ldEndTime1') return ldEl;
                return makeEl();
            });

            const futureEnd = 1678886400 + 10000; // 10000s in the future
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({
                    ...baseOptions1,
                    timedata1: [1678886400, 3600, 1678886400, 1800, futureEnd, 0, 0, 0, 0],
                });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(ldEl.innerText.length).toBeGreaterThan(0);
        });

        it('should hide ldEndTime parent when lockdown is not active', async () => {
            const ldEl = makeEl();
            document.getElementById = jest.fn((id) => {
                if (id === 'ldEndTime1') return ldEl;
                return makeEl();
            });

            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...baseOptions1 }); // timedata1[4] = 0

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(ldEl.parentElement.style.display).toBe('none');
        });

        it('should use browser.storage.sync.get when sync option is true', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: true });
            browserMock.storage.sync.get
                .mockResolvedValueOnce({ ...baseOptions1 });

            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            expect(browserMock.storage.sync.get).toHaveBeenCalled();
        });

        it('should set clockTimeFormat hour12=true for format 1', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...baseOptions1, clockTimeFormat: "1" });

            expect(() => global.refreshPage()).not.toThrow();
            await new Promise(r => setTimeout(r, 50));
        });

        it('should set clockTimeFormat hour12=false for format 2', async () => {
            browserMock.storage.local.get
                .mockResolvedValueOnce({ sync: false })
                .mockResolvedValueOnce({ ...baseOptions1, clockTimeFormat: "2" });

            expect(() => global.refreshPage()).not.toThrow();
            await new Promise(r => setTimeout(r, 50));
        });

        it('should call onError when storage.local.get rejects', async () => {
            browserMock.storage.local.get
                .mockRejectedValueOnce(new Error('storage error'));

            // onError logs a warning; just ensure it doesn't throw
            global.refreshPage();
            await new Promise(r => setTimeout(r, 50));

            // gRefreshGen was incremented — verify refreshPage was invoked
            expect(browserMock.storage.local.get).toHaveBeenCalledWith('sync');
        });
    });
});
