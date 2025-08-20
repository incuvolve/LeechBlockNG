const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Mock browser API
const browserMock = {
    runtime: {
        sendMessage: jest.fn().mockResolvedValue(null),
        getURL: jest.fn((url) => `chrome-extension://test/${url}`),
    },
    tabs: {
        remove: jest.fn(),
    },
};

let dom;
let window;
let document;

const blockedHtmlPath = path.resolve(__dirname, '../blocked.html');
let blockedHtml = fs.readFileSync(blockedHtmlPath, 'utf8');

// Remove script tags from HTML to prevent JSDOM from trying to load them
blockedHtml = blockedHtml.replace(/<script[^>]*>[^<]*<\/script>/g, '');

const blockedJsPath = path.resolve(__dirname, '../blocked.js');
const blockedJsCode = fs.readFileSync(blockedJsPath, 'utf8');

describe('blocked.js', () => {
    beforeAll(() => {
        dom = new JSDOM(blockedHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost',
        });
        window = dom.window;
        document = window.document;

        window.browser = browserMock;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        dom = new JSDOM(blockedHtml, {
            runScripts: 'dangerously',
            resources: 'usable',
            url: 'http://localhost',
        });
        window = dom.window;
        document = window.document;
        window.browser = browserMock;
        dom.window.eval(blockedJsCode);
    });

    afterAll(() => {
        dom.window.close();
    });

    // Expose hashCode32 from the context to global scope
    const hashCode32 = (str) => window.hashCode32(str);

    describe('hashCode32', () => {
        test('should generate a consistent hash for a given string', () => {
            expect(hashCode32('test')).toBe(3556498);
            expect(hashCode32('hello world')).toBe(1794106052);
            expect(hashCode32('')).toBe(0);
        });

        test('should generate different hashes for different strings', () => {
            expect(hashCode32('test1')).not.toBe(hashCode32('test2'));
        });
    });

    describe('processBlockInfo', () => {
                it('should process block info and update DOM elements', async () => {
            const mockInfo = {
                blockedURL: 'http://blocked.com/path#hash',
                blockedSet: '3',
                blockedSetName: 'Work Sites',
                keywordMatch: 'distraction',
                password: 'secret',
                customMsg: 'Take a break!',
                unblockTime: '10:00 AM',
                delaySecs: 5,
                delayCancel: true,
                reloadSecs: 10,
                theme: 'dark',
                customStyle: 'body { background-color: #333; }',
                disableLink: false,
            };

            window.processBlockInfo(mockInfo);
            await new Promise(resolve => setTimeout(resolve, 0));

            expect(document.getElementById('ivbBlockedURL').innerText).toBe('http://blocked.com/path#hash');
            expect(document.getElementById('ivbBlockedURLLink').getAttribute('href')).toBe('http://blocked.com/path#hash');
            expect(document.getElementById('ivbBlockedSet').innerText).toBe('Work Sites');
            expect(document.getElementById('ivbKeywordMatched').style.display).toBe('');
            expect(document.getElementById('ivbKeywordMatch').innerText).toBe('distraction');
            expect(document.getElementById('ivbCustomMsgDiv').style.display).toBe('');
            expect(document.getElementById('ivbCustomMsg').innerText).toBe('Take a break!');
            expect(document.getElementById('ivbUnblockTime').innerText).toBe('10:00 AM');
            expect(document.getElementById('themeLink').getAttribute('href')).toBe('/themes/dark.css');
            expect(document.getElementById('customStyle').innerText).toBe('body { background-color: #333; }');

            // Test password input
            const passwordInput = document.querySelector('#ivbPasswordInput');
            const passwordSubmit = document.querySelector('#ivbPasswordSubmit');
            expect(passwordInput).not.toBeNull();
            expect(passwordSubmit).not.toBeNull();

            // Simulate correct password submission
            passwordInput.value = 'secret';
            passwordSubmit.click();
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'password',
                blockedURL: 'http://blocked.com/path#hash',
                blockedSet: '3',
            });

            // Simulate incorrect password submission
            passwordInput.value = 'wrong';
            passwordSubmit.click();
            expect(passwordInput.value).toBe('');
            expect(passwordInput.classList.contains('error')).toBe(true);
            // Advance timers to clear the error class
            jest.advanceTimersByTime(400);
            expect(passwordInput.classList.contains('error')).toBe(false);

            // Test delay countdown
            jest.useFakeTimers();
            const initialDelaySecs = parseInt(document.getElementById('ivbDelaySeconds').innerText);
            expect(initialDelaySecs).toBe(5);

            jest.advanceTimersByTime(1000); // 1 second
            expect(document.getElementById('ivbDelaySeconds').innerText).toBe('4');

            jest.advanceTimersByTime(4000); // Remaining 4 seconds
            expect(document.getElementById('ivbDelaySeconds').innerText).toBe('0');
            expect(browserMock.runtime.sendMessage).toHaveBeenCalledWith({
                type: 'delayed',
                blockedURL: 'http://blocked.com/path#hash',
                blockedSet: '3',
            });
            jest.useRealTimers();

            // Test reloadSecs
            jest.useFakeTimers();
            const reloadBlockedPageSpy = jest.spyOn(window.document.location, 'href', 'set');
            // Re-mock sendMessage to return mockInfo for the 'blocked' type for this test
            browserMock.runtime.sendMessage.mockImplementationOnce((message) => {
                if (message.type === 'blocked') {
                    return Promise.resolve({ ...mockInfo, reloadSecs: 1 }); // Set reloadSecs to 1 for this test
                }
                return Promise.resolve(null);
            });
            // Re-trigger processBlockInfo for this test case
            const event = new window.Event('DOMContentLoaded', { bubbles: true, cancelable: true });
            document.dispatchEvent(event);
            await new Promise(resolve => setTimeout(resolve, 0));

            jest.advanceTimersByTime(1000); // 1 second
            expect(reloadBlockedPageSpy).toHaveBeenCalledWith('http://blocked.com/path#hash');
            jest.useRealTimers();
        });

        it('should hide keyword matched if no keywordMatch', async () => {
            const mockInfo = {
                blockedURL: 'http://blocked.com',
                blockedSet: '1',
                keywordMatch: null,
            };
            window.processBlockInfo(mockInfo);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(document.getElementById('ivbKeywordMatched').style.display).toBe('none');
        });

        it('should hide custom message if no customMsg', async () => {
            const mockInfo = {
                blockedURL: 'http://blocked.com',
                blockedSet: '1',
                customMsg: null,
            };
            window.processBlockInfo(mockInfo);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(document.getElementById('ivbCustomMsgDiv').style.display).toBe('none');
        });

        it('should disable link if disableLink is true', async () => {
            const mockInfo = {
                blockedURL: 'http://blocked.com',
                blockedSet: '1',
                disableLink: true,
            };
            window.processBlockInfo(mockInfo);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(document.getElementById('ivbBlockedURLLink').hasAttribute('href')).toBe(false);
        });

        it('should handle long blocked URLs', async () => {
            const longUrl = 'http://verylongdomainname.com/very/long/path/to/a/resource/that/is/blocked/by/ivblock/because/it/is/too/distracting/and/has/a/very/long/query/string?param1=value1&param2=value2&param3=value3';
            const mockInfo = {
                blockedURL: longUrl,
                blockedSet: '1',
            };
            window.processBlockInfo(mockInfo);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect(document.getElementById('ivbBlockedURL').innerText.length).toBeLessThanOrEqual(60);
            expect(document.getElementById('ivbBlockedURL').innerText).toMatch(/\.\.\.$/);
        });
    });
});
