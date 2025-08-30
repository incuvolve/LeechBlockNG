/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser API
const browserMock = {
    storage: {
        local: {
            get: jest.fn(() => Promise.resolve({ sync: false }))
        },
        sync: {
            get: jest.fn(() => Promise.resolve({ sync: true }))
        },
        set: jest.fn(() => Promise.resolve())
    },
    runtime: {
        sendMessage: jest.fn()
    }
};

// Mock jQuery and DOM elements
const mockDomElement = (initialValue = '') => ({
    value: initialValue,
    checked: false,
    innerHTML: '',
    innerText: '',
    style: { display: '' },
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    textContent: '',
    // Add a mock for the 'on' method for jQuery event handling
    on: jest.fn(),
});

// Mock jQuery and DOM elements
const mockDomElement = (initialValue = '') => ({
    value: initialValue,
    checked: false,
    innerHTML: '',
    innerText: '',
    style: { display: '' },
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    textContent: '',
    // Add a mock for the 'on' method for jQuery event handling
    on: jest.fn(),
});

const mockJQueryInstance = {
    jquery: '3.6.0', // Simulate jQuery version
    html: jest.fn(function(content) {
        if (content !== undefined) {
            this[0].innerHTML = content;
            return this;
        } else {
            return this[0].innerHTML;
        }
    }),
    val: jest.fn(function(value) {
        if (value !== undefined) {
            this[0].value = value;
            return this;
        } else {
            return this[0].value;
        }
    }),
    button: jest.fn(function() { return this; }),
    click: jest.fn(function() { return this; }),
    keydown: jest.fn(function() { return this; }),
    dialog: jest.fn(function(options) {
        if (options === "open") {
            this.isOpen = true;
        } else if (options === "close") {
            this.isOpen = false;
        }
        return this; // Allow chaining
    }),
    show: jest.fn(function() {
        this[0].style.display = '';
        return this;
    }),
    hide: jest.fn(function(options) {
        this[0].style.display = 'none';
        if (options && options.complete) {
            options.complete();
        }
        return this;
    }),
    effect: jest.fn(function(options) {
        if (options && options.complete) {
            options.complete();
        }
        return this;
    }),
    append: jest.fn(function(content) {
        this[0].innerHTML += content;
        return this;
    }),
    on: jest.fn(function() { return this; }),
    // This is crucial: the [0] property holds the actual DOM element mock
    0: mockDomElement(),
    length: 1,
};

// The global $ function should return the mockJQueryInstance
const jQueryMock = jest.fn((selector) => {
    // Reset the internal DOM element mock for each new selection
    mockJQueryInstance[0] = mockDomElement();
    if (typeof selector === 'string') {
        if (selector.startsWith('#')) {
            const id = selector.substring(1);
            // Simulate getElementById for the selector
            const element = context.document.getElementById(id);
            if (element) {
                mockJQueryInstance[0] = element;
            }
        } else if (selector.startsWith('div[id^='alert']')) {
            // For alert dialogs, return a generic mock element
            mockJQueryInstance[0] = mockDomElement();
        }
    } else if (selector instanceof HTMLElement) {
        mockJQueryInstance[0] = selector;
    }
    return mockJQueryInstance;
});

// Create a context for vm.runInContext
const context = vm.createContext({
    document: {
        getElementById: jest.fn((id) => {
            const element = mockDomElement();
            element.id = id;
            if (id === 'form') {
                element.innerHTML = '<div id="blockSets"></div>';
            } else if (id.startsWith('blockSet')) {
                element.checked = false;
            } else if (id.startsWith('blockSetLabel')) {
                element.innerText = 'Block Set ' + id.replace('blockSetLabel', '');
            }
            return element;
        }),
        querySelectorAll: jest.fn((selector) => {
            if (selector.startsWith('[id^=tabBlockSet]')) {
                const numSets = context.window.gNumSets || 0;
                const elements = [];
                for (let i = 1; i <= numSets; i++) {
                    elements.push(context.document.getElementById('blockSet' + i));
                }
                return elements;
            }
            return [];
        }),
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        createElement: jest.fn(() => mockDomElement()),
    },
    window: {
        Event: global.Event,
        MAX_SETS: 10,
        DEFAULT_BLOCK_URL: "blocked.html",
        DELAYED_BLOCK_URL: "delayed.html",
        PASSWORD_BLOCK_URL: "password.html",
        ALL_DAY_TIMES: "0000-2400",
        GENERAL_OPTIONS: {},
        PER_SET_OPTIONS: {},
        SUB_OPTIONS: {},
        gFormHTML: '',
        gNumSets: undefined,
        gClockOffset: undefined,
    },
    browser: browserMock,
    console: global.console,
    setTimeout: global.setTimeout,
    setInterval: global.setInterval,
    clearTimeout: global.clearTimeout,
    clearInterval: global.clearInterval,
    Promise: global.Promise,
    $: jQueryMock,
});


// The global $ function should return the mockJQueryInstance
const jQueryMock = jest.fn((selector) => {
    // Reset the internal DOM element mock for each new selection
    mockJQueryInstance[0] = mockDomElement();
    if (typeof selector === 'string') {
        if (selector.startsWith('#')) {
            const id = selector.substring(1);
            // Simulate getElementById for the selector
            const element = context.document.getElementById(id);
            if (element) {
                mockJQueryInstance[0] = element;
            }
        } else if (selector.startsWith('div[id^=\'alert\']')) {
            // For alert dialogs, return a generic mock element
            mockJQueryInstance[0] = mockDomElement();
        }
    } else if (selector instanceof HTMLElement) {
        mockJQueryInstance[0] = selector;
    }
    return mockJQueryInstance;
});

// Create a context for vm.runInContext
const context = vm.createContext({
    document: {
        getElementById: jest.fn((id) => {
            const element = mockDomElement();
            element.id = id;
            if (id === 'form') {
                element.innerHTML = '<div id="blockSets"></div>';
            } else if (id.startsWith('blockSet')) {
                element.checked = false;
            } else if (id.startsWith('blockSetLabel')) {
                element.innerText = 'Block Set ' + id.replace('blockSetLabel', '');
            }
            return element;
        }),
        querySelectorAll: jest.fn((selector) => {
            if (selector.startsWith('[id^=tabBlockSet]')) {
                const numSets = context.window.gNumSets || 0;
                const elements = [];
                for (let i = 1; i <= numSets; i++) {
                    elements.push(context.document.getElementById('blockSet' + i));
                }
                return elements;
            }
            return [];
        }),
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        createElement: jest.fn(() => mockDomElement()),
    },
    window: {
        Event: global.Event,
        MAX_SETS: 10,
        DEFAULT_BLOCK_URL: "blocked.html",
        DELAYED_BLOCK_URL: "delayed.html",
        PASSWORD_BLOCK_URL: "password.html",
        ALL_DAY_TIMES: "0000-2400",
        GENERAL_OPTIONS: {},
        PER_SET_OPTIONS: {},
        SUB_OPTIONS: {},
        gFormHTML: '',
        gNumSets: undefined,
        gClockOffset: undefined,
    },
    browser: browserMock,
    console: global.console,
    setTimeout: global.setTimeout,
    setInterval: global.setInterval,
    clearTimeout: global.clearTimeout,
    clearInterval: global.clearInterval,
    Promise: global.Promise,
    $: jQueryMock,
});


// Load common.js into the context to get cleanOptions and setTheme
const commonJsPath = path.resolve(__dirname, '../common.js');
const commonJsCode = fs.readFileSync(commonJsPath, 'utf8');
vm.runInContext(commonJsCode, context);

// Load lockdown.js into the context
const lockdownJsPath = path.resolve(__dirname, '../lockdown.js');
const lockdownJsCode = fs.readFileSync(lockdownJsPath, 'utf8');
vm.runInContext(lockdownJsCode, context);

// Expose functions from the context to global scope
global.initForm = context.initForm;
global.initializePage = context.initializePage;
global.refreshPage = context.refreshPage;
global.testURL = context.testURL;

global.onActivate = context.onActivate;
global.onCancel = context.onCancel;
global.closePage = context.closePage;

// Expose mocks for assertions
global.browser = browserMock;
global.$ = context.$;
global.mockJQuery = context.$;
global.cleanOptions = context.cleanOptions;
global.setTheme = context.setTheme;

describe('lockdown.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset gFormHTML in the context
        context.window.gFormHTML = '<div id="form"><div id="blockSets"><input type="checkbox" id="blockSet1"><label id="blockSetLabel1">Block Set 1</label></div></div>'; // Minimal mock for #form
        // Reset gNumSets and gClockOffset
        context.window.gNumSets = undefined;
        context.window.gClockOffset = undefined;

        // Reset the mock DOM elements
        context.document.getElementById.mockClear();
        context.document.querySelectorAll.mockClear();
        context.document.addEventListener.mockClear();
        context.document.dispatchEvent.mockClear();
        context.document.createElement.mockClear();

        // Mock getElementById for lockdown.js
        context.document.getElementById.mockImplementation((id) => {
            const element = mockDomElement();
            element.id = id;
            if (id === 'form') {
                element.innerHTML = '<div id="blockSets"></div>';
            } else if (id.startsWith('blockSet')) {
                element.checked = false;
            } else if (id.startsWith('blockSetLabel')) {
                element.innerText = 'Block Set ' + id.replace('blockSetLabel', '');
            }
            return element;
        });

        // Mock querySelectorAll for lockdown.js
        context.document.querySelectorAll.mockImplementation((selector) => {
            if (selector.startsWith('[id^=tabBlockSet]')) {
                const numSets = context.window.gNumSets || 0;
                const elements = [];
                for (let i = 1; i <= numSets; i++) {
                    elements.push(context.document.getElementById('blockSet' + i));
                }
                return elements;
            }
            return [];
        });

        // Mock jQuery dialog buttons
        jest.spyOn(mockJQueryInstance, 'dialog').mockImplementation(function(options) {
            if (options === "open") {
                this.isOpen = true;
            } else if (options === "close") {
                this.isOpen = false;
            }
            return this; // Allow chaining
        });
    });

    describe('onCancel', () => {
        it('should call closePage', () => {
            const closePageSpy = jest.spyOn(context, 'closePage'); // Spy on context.closePage
            global.onCancel();
            expect(closePageSpy).toHaveBeenCalledTimes(1);
            closePageSpy.mockRestore();
        });
    });

    describe('closePage', () => {
        it('should send a message to close the page', () => {
            global.closePage();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({ type: 'close' });
        });
    });

    // Placeholder tests for functions that require more complex DOM/jQuery UI mocking
    describe('Complex lockdown.js functions (placeholders)', () => {
        // These tests are commented out due to persistent issues with mocking jQuery and
        // spying on functions within the vm.runInContext context. Comprehensive testing
        // would require significant refactoring of lockdown.js or a more advanced testing setup.

        it('initForm should initialize form elements', () => {
            const initFormSpy = jest.spyOn(context, 'initForm');
            global.initForm(1);
            expect(initFormSpy).toHaveBeenCalledWith(1);
            expect(mockJQueryInstance.button).toHaveBeenCalled();
            expect(mockJQueryInstance.click).toHaveBeenCalled();
            expect(mockJQueryInstance.keydown).toHaveBeenCalled();
            expect(mockJQueryInstance.val).toHaveBeenCalledWith("");
            initFormSpy.mockRestore();
        });

        it('initForm should create 0 block sets when numSets is 0', () => {
            global.initForm(0);
            const tabs = global.document.querySelectorAll('[id^=tabBlockSet]');
            expect(tabs.length).toBe(0);
        });

        it('initForm should create 3 block sets when numSets is 3', () => {
            global.initForm(3);
            const tabs = context.document.querySelectorAll('[id^=tabBlockSet]');
            expect(tabs.length).toBe(3);
            expect(context.document.getElementById('blockSetLabel1').innerText).toBe('Block Set 1');
            expect(context.document.getElementById('blockSetLabel2').innerText).toBe('Block Set 2');
            expect(context.document.getElementById('blockSetLabel3').innerText).toBe('Block Set 3');
        });

        it('initForm should append custom set names to labels', async () => {
            context.window.gFormHTML = '<div id="form"><div id="blockSets"><input type="checkbox" id="blockSet1"><label id="blockSetLabel1">Block Set 1</label></div></div>';

            // Mock getElementById for this specific test to return elements with innerText
            context.document.getElementById.mockImplementation((id) => {
                const element = mockDomElement();
                element.id = id;
                if (id === 'blockSetLabel1') element.innerText = 'Block Set 1';
                if (id === 'blockSetLabel2') element.innerText = 'Block Set 2';
                return element;
            });

            // Simulate options with custom set names
            browserMock.storage.local.get.mockResolvedValue({
                numSets: 2,
                setName1: 'My Work',
                setName2: 'My Social',
            });

            await global.initializePage(); // Call initializePage to trigger initForm and refreshPage

            expect(context.document.getElementById('blockSetLabel1').innerText).toContain('(My Work)');
            expect(context.document.getElementById('blockSetLabel2').innerText).toContain('(My Social)');
        });

        it('initializePage should fetch options and initialize form', async () => {
            const mockOptions = { numSets: 2, theme: 'dark', lockdownHours: 1, lockdownMins: 30, lockdown1: true, lockdown2: false, setName1: 'Work', setName2: 'Social' };
            browserMock.storage.local.get.mockResolvedValue(mockOptions);
            const initFormSpy = jest.spyOn(context, 'initForm');
            const setThemeSpy = jest.spyOn(context, 'setTheme');

            await global.initializePage();

            expect(browserMock.storage.local.get).toHaveBeenCalledWith("sync");
            expect(browserMock.storage.local.get).toHaveBeenCalledWith(undefined);
            expect(initFormSpy).toHaveBeenCalledWith(mockOptions.numSets);
            expect(setThemeSpy).toHaveBeenCalledWith(mockOptions.theme);
            expect(global.document.getElementById('hours').value).toBe(String(mockOptions.lockdownHours));
            expect(global.document.getElementById('mins').value).toBe(String(mockOptions.lockdownMins));
            expect(global.document.getElementById('blockSet1').checked).toBe(mockOptions.lockdown1);
            expect(global.document.getElementById('blockSet2').checked).toBe(mockOptions.lockdown2);
            expect(global.document.getElementById('blockSetLabel1').innerText).toContain(` (${mockOptions.setName1})`);
            expect(global.document.getElementById('blockSetLabel2').innerText).toContain(` (${mockOptions.setName2})`);

            initFormSpy.mockRestore();
            setThemeSpy.mockRestore();
        });

        it('refreshPage should use sync storage if options.sync is true', async () => {
            browserMock.storage.local.get.mockResolvedValue({ sync: true });
            browserMock.storage.sync.get.mockResolvedValue({ numSets: 1, theme: 'light' });
            const initFormSpy = jest.spyOn(context, 'initForm');
            const setThemeSpy = jest.spyOn(context, 'setTheme');

            await context.refreshPage();

            expect(browserMock.storage.local.get).toHaveBeenCalledWith("sync");
            expect(browserMock.storage.sync.get).toHaveBeenCalled();
            expect(initFormSpy).toHaveBeenCalledWith(1);
            expect(setThemeSpy).toHaveBeenCalledWith('light');

            initFormSpy.mockRestore();
            setThemeSpy.mockRestore();
        });

        it('refreshPage should handle error during storage retrieval', async () => {
            browserMock.storage.local.get.mockRejectedValue(new Error('Storage error'));
            const warnSpy = jest.spyOn(global.console, 'warn').mockImplementation(() => {});
            const dialogSpy = jest.spyOn(jQueryMock('#alertRetrieveError'), 'dialog');

            await context.refreshPage();

            expect(warnSpy).toHaveBeenCalledWith('Cannot get options: Error: Storage error');
            expect(dialogSpy).toHaveBeenCalledWith('open');

            warnSpy.mockRestore();
            dialogSpy.mockRestore();
        });

        it('refreshPage should initialize form with default values if options are missing', async () => {
            browserMock.storage.local.get.mockResolvedValue({}); // No options
            const initFormSpy = jest.spyOn(context, 'initForm');
            const setThemeSpy = jest.spyOn(context, 'setTheme');

            await context.refreshPage();

            expect(initFormSpy).toHaveBeenCalledWith(6); // Default numSets
            expect(setThemeSpy).toHaveBeenCalledWith('light'); // Default theme
            expect(global.document.getElementById('hours').value).toBe('0');
            expect(global.document.getElementById('mins').value).toBe('0');

            initFormSpy.mockRestore();
            setThemeSpy.mockRestore();
        });

        it('onActivate should handle activation logic', async () => {
            const onActivateSpy = jest.spyOn(context, 'onActivate');
            context.gNumSets = 2; // Set gNumSets for the test
            context.gClockOffset = 0; // Set gClockOffset for the test

            // Mock Date.now() to a fixed value for predictable endTime
            const mockDateNow = 1678886400000; // March 15, 2023 00:00:00 GMT
            jest.spyOn(Date, 'now').mockReturnValue(mockDateNow);

            // Mock getElementById for hours, mins, and blockSet checkboxes
            jest.spyOn(global.document, 'getElementById').mockImplementation((id) => {
                if (id === 'hours') return { value: '1' };
                if (id === 'mins') return { value: '30' };
                if (id === 'blockSet1') return { checked: true };
                if (id === 'blockSet2') return { checked: false };
                return null;
            });

            await global.onActivate();

            expect(onActivateSpy).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(1);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'lockdown',
                endTime: mockDateNow / 1000 + (1 * 3600) + (30 * 60),
                set: 1,
            });
            expect(browserMock.storage.set).toHaveBeenCalledTimes(1);
            expect(browserMock.storage.set).toHaveBeenCalledWith({
                lockdownHours: '1',
                lockdownMins: '30',
                lockdown1: true,
                lockdown2: false,
            });

            onActivateSpy.mockRestore();
            Date.now.mockRestore();
        });

        it('onActivate should show alert if duration is invalid', async () => {
            const dialogSpy = jest.spyOn(jQueryMock('#alertNoDuration'), 'dialog');

            // Test with no duration
            jest.spyOn(global.document, 'getElementById').mockImplementation((id) => {
                if (id === 'hours') return { value: '0' };
                if (id === 'mins') return { value: '0' };
                if (id === 'blockSet1') return { checked: true };
                return null;
            });
            await global.onActivate();
            expect(dialogSpy).toHaveBeenCalledWith('open');
            dialogSpy.mockClear();

            // Test with negative duration (though input type=number prevents this, good for robustness)
            jest.spyOn(global.document, 'getElementById').mockImplementation((id) => {
                if (id === 'hours') return { value: '-1' };
                if (id === 'mins') return { value: '0' };
                if (id === 'blockSet1') return { checked: true };
                return null;
            });
            await global.onActivate();
            expect(dialogSpy).toHaveBeenCalledWith('open');

            dialogSpy.mockRestore();
        });

        it('onActivate should show alert if no sets are selected', async () => {
            const dialogSpy = jest.spyOn(jQueryMock('#alertNoSets'), 'dialog');

            jest.spyOn(global.document, 'getElementById').mockImplementation((id) => {
                if (id === 'hours') return { value: '1' };
                if (id === 'mins') return { value: '0' };
                if (id === 'blockSet1') return { checked: false };
                if (id === 'blockSet2') return { checked: false };
                return null;
            });
            context.window.gNumSets = 2;

            await global.onActivate();

            expect(dialogSpy).toHaveBeenCalledWith('open');
            expect(browserMock.runtime.sendMessage).not.toHaveBeenCalled();
            expect(browserMock.storage.set).not.toHaveBeenCalled();

            dialogSpy.mockRestore();
        });

        it('onActivate should send messages and save options for multiple selected sets', async () => {
            const mockDateNow = 1678886400000;
            jest.spyOn(Date, 'now').mockReturnValue(mockDateNow);

            jest.spyOn(global.document, 'getElementById').mockImplementation((id) => {
                if (id === 'hours') return { value: '0' };
                if (id === 'mins') return { value: '5' };
                if (id === 'blockSet1') return { checked: true };
                if (id === 'blockSet2') return { checked: true };
                return null;
            });
            context.gNumSets = 2;
            context.gClockOffset = 0;

            await global.onActivate();

            expect(browserMock.runtime.sendMessage).toHaveBeenCalledTimes(2);
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'lockdown',
                endTime: mockDateNow / 1000 + (5 * 60),
                set: 1,
            });
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'lockdown',
                endTime: mockDateNow / 1000 + (5 * 60),
                set: 2,
            });
            expect(browserMock.storage.set).toHaveBeenCalledTimes(1);
            expect(browserMock.storage.set).toHaveBeenCalledWith({
                lockdownHours: '0',
                lockdownMins: '5',
                lockdown1: true,
                lockdown2: true,
            });

            Date.now.mockRestore();
        });
    });
});