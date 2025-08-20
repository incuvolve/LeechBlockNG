const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock browser API
const browserMock = {
    runtime: {
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        }
    }
};

// Create a context for vm.runInContext
const context = vm.createContext({
    document: global.document,
    window: global.window,
    browser: browserMock,
    console: global.console,
    setTimeout: global.setTimeout,
    setInterval: global.setInterval,
    clearTimeout: global.clearTimeout,
    clearInterval: global.clearInterval,
    Promise: global.Promise,
});

// Load content.js into the context
const contentJsPath = path.resolve(__dirname, '../content.js');
const contentJsCode = fs.readFileSync(contentJsPath, 'utf8');
vm.runInContext(contentJsCode, context);

// Expose functions from the context to global scope
global.notifyLoaded = context.notifyLoaded;
global.updateTimer = context.updateTimer;
global.showAlert = context.showAlert;
global.hideAlert = context.hideAlert;
global.checkKeyword = context.checkKeyword;
global.applyFilter = context.applyFilter;
global.handleMessage = context.handleMessage;
global.onFocus = context.onFocus;
global.onBlur = context.onBlur;
global.onUnload = context.onUnload;

// Expose mocks for assertions
global.browser = browserMock;
// Expose gTimer and gAlert from the context for assertions
global.gTimer = context.gTimer;
global.gAlert = context.gAlert;

describe('content.js', () => {
    let createElementSpy;
    let appendChildSpy;
    let removeChildSpy;
    let addEventListenerSpy;
    let setAttributeSpy;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reset gTimer and gAlert in the context to ensure re-creation
        context.gTimer = null;
        context.gAlert = null;

        // Spy on real DOM methods
        createElementSpy = jest.spyOn(global.document, 'createElement');
        appendChildSpy = jest.spyOn(global.document.body, 'appendChild');
        removeChildSpy = jest.spyOn(global.document.body, 'removeChild'); // Spy on document.body for dynamically created elements
        addEventListenerSpy = jest.spyOn(global.HTMLElement.prototype, 'addEventListener');
        setAttributeSpy = jest.spyOn(global.HTMLElement.prototype, 'setAttribute');

        // Reset document properties
        global.document.title = 'Test Title';
        global.document.body.innerText = 'Test Body Text';
        global.document.documentElement.style.filter = ''; // Clear filter
    });

    afterEach(() => {
        createElementSpy.mockRestore();
        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
        addEventListenerSpy.mockRestore();
        setAttributeSpy.mockRestore();
    });

    describe('checkKeyword', () => {
        it('should return null if keywordRE is null', () => {
            expect(global.checkKeyword(null, false)).toBeNull();
        });

        it('should find keyword in title only', () => {
            global.document.title = 'This is a keyword in the title';
            const keywordRE = /keyword/;
            expect(global.checkKeyword(keywordRE, true)).toBe('keyword');
        });

        it('should find keyword in body text', () => {
            global.document.title = 'Some Title';
            global.document.body.innerText = 'This is a keyword in the body';
            const keywordRE = /keyword/;
            expect(global.checkKeyword(keywordRE, false)).toBe('keyword');
        });

        it('should return null if keyword not found', () => {
            global.document.title = 'No Match';
            global.document.body.innerText = 'No Match';
            const keywordRE = /nonexistent/;
            expect(global.checkKeyword(keywordRE, false)).toBeNull();
        });

        it('should handle regex with special characters', () => {
            global.document.title = 'Test.com?param=value';
            const keywordRE = /Test\.com\?param=value/;
            expect(global.checkKeyword(keywordRE, true)).toBe('Test.com?param=value');
        });
    });

    describe('applyFilter', () => {
        it('should apply the specified filter', () => {
            global.applyFilter('grayscale');
            expect(global.document.documentElement.style.filter).toBe('grayscale(100%)');
        });

        it('should set filter to none for unknown filter name', () => {
            global.applyFilter('unknownFilter');
            expect(global.document.documentElement.style.filter).toBe('none');
        });

        it('should set filter to none for null filter name', () => {
            global.applyFilter(null);
            expect(global.document.documentElement.style.filter).toBe('none');
        });
    });

    describe('Complex content.js functions', () => {
        it('notifyLoaded should send messages to background script', () => {
            global.notifyLoaded();
            expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ type: "loaded", url: global.document.URL });
            expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ type: "referrer", referrer: global.document.referrer });
        });

        it('updateTimer should create and update timer element', () => {
            global.updateTimer('10:00', 0, 0);
            expect(createElementSpy).toHaveBeenCalledWith('div');
            expect(setAttributeSpy).toHaveBeenCalledWith('class', 'ivblock-timer');
            expect(appendChildSpy).toHaveBeenCalledWith(context.gTimer); // gTimer is the actual element created
            expect(context.gTimer.innerText).toBe('10:00');
            expect(context.gTimer.style.fontSize).toBe('10px');
            expect(context.gTimer.style.top).toBe('0px');
            expect(context.gTimer.hidden).toBe(false);
        });

        it('showAlert should create and display alert message', () => {
            global.showAlert('Warning!');
            expect(createElementSpy).toHaveBeenCalledWith('div'); // For container
            expect(createElementSpy).toHaveBeenCalledWith('div'); // For alertBox
            expect(createElementSpy).toHaveBeenCalledWith('div'); // For alertIcon
            expect(createElementSpy).toHaveBeenCalledWith('div'); // For alertText
            expect(appendChildSpy).toHaveBeenCalledWith(context.gAlert); // gAlert is the actual element created
            expect(context.gAlert.style.display).toBe('flex');
        });

        it('hideAlert should hide alert message', () => {
            global.showAlert('Test'); // Ensure gAlert is created
            jest.clearAllMocks(); // Clear mocks from showAlert
            global.hideAlert();
            expect(context.gAlert.style.display).toBe('none');
        });

        it('handleMessage should dispatch based on message type', () => {
            global.handleMessage({ type: 'alert', text: 'Test' }, {}, jest.fn());
            expect(context.gAlert.style.display).toBe('flex'); // Assuming showAlert was called
            jest.clearAllMocks();

            global.handleMessage({ type: 'filter', name: 'grayscale' }, {}, jest.fn());
            expect(global.document.documentElement.style.filter).toBe('grayscale(100%)');
            jest.clearAllMocks();

            global.handleMessage({ type: 'keyword', keywordRE: /test/, titleOnly: true }, {}, jest.fn());
            // This will call checkKeyword, which we've already tested.
            // Just ensure it doesn't throw.
            expect(() => global.handleMessage({ type: 'keyword', keywordRE: /test/, titleOnly: true }, {}, jest.fn())).not.toThrow();
            jest.clearAllMocks();

            global.handleMessage({ type: 'ping' }, {}, jest.fn());
            expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ type: "loaded", url: global.document.URL });
            jest.clearAllMocks();

            global.handleMessage({ type: 'timer', text: '10:00', size: 0, location: 0 }, {}, jest.fn());
            expect(context.gTimer.innerText).toBe('10:00');
        });

        it('onFocus should send focus message', () => {
            global.onFocus();
            expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ type: "focus", focus: true });
        });

        it('onBlur should send blur message', () => {
            global.onBlur();
            expect(global.browser.runtime.sendMessage).toHaveBeenCalledWith({ type: "focus", focus: false });
        });

        it('onUnload should remove timer and alert elements', () => {
            global.updateTimer('10:00', 0, 0); // Create gTimer
            global.showAlert('Test'); // Create gAlert
            jest.clearAllMocks(); // Clear mocks from setup calls

            global.onUnload();

            // Check if removeChild was called on the parentNode of gTimer and gAlert
            // The parentNode is the document.body in this case
            expect(removeChildSpy).toHaveBeenCalledTimes(2);
        });
    });
});