global.warn = jest.fn();

require('../common.js');

const {
    cleanSites,
    formatTime,
    getCleanURL,
    checkTimePeriodsFormat,
    allTrue,
    hashCode32,
    listObjectProperties,
    cleanOptions,
    cleanTimeData,
    getParsedURL,
    getRegExpSites,
    patternToRegExp,
    keywordToRegExp,
    checkPosIntFormat,
    checkPosNegIntFormat,
    checkPosNumberFormat,
    checkBlockURLFormat,
    getMinPeriods,
    cleanTimePeriods,
    getTimePeriodStart,
    updateRolloverTime,
    encodeDays,
    decodeDays,
    createAccessCode,
    setTheme,
    localize,
    getTimestampSuffix,
} = window;

describe('common.js tests', () => {
    describe('cleanSites', () => {
        it('should remove extra whitespace and sort sites', () => {
            const sites = '  site2.com   site1.com  site3.com  ';
            const expected = 'site1.com site2.com site3.com';
            expect(cleanSites(sites)).toBe(expected);
        });

        it('should handle an empty string', () => {
            expect(cleanSites('')).toBe('');
        });

        it('should handle a single site', () => {
            expect(cleanSites('  site1.com  ')).toBe('site1.com');
        });
    });

    describe('formatTime', () => {
        it('should format seconds into HH:MM:SS', () => {
            expect(formatTime(3661)).toBe('01:01:01');
        });

        it('should handle 0 seconds', () => {
            expect(formatTime(0)).toBe('00:00:00');
        });

        it('should handle negative seconds', () => {
            expect(formatTime(-3661)).toBe('-01:01:01');
        });
    });

    describe('getCleanURL', () => {
        it('should remove view-source: prefix', () => {
            const url = 'view-source:http://example.com';
            const expected = 'http://example.com';
            expect(getCleanURL(url)).toBe(expected);
        });

        it('should remove about:reader?url= prefix and decode URL', () => {
            const url = 'about:reader?url=http%3A%2F%2Fexample.com';
            const expected = 'http://example.com';
            expect(getCleanURL(url)).toBe(expected);
        });

        it('should return the same url if no prefix is present', () => {
            const url = 'http://example.com';
            expect(getCleanURL(url)).toBe(url);
        });
    });

    describe('checkTimePeriodsFormat', () => {
        it('should return true for valid time periods', () => {
            expect(checkTimePeriodsFormat('0900-1700')).toBe(true);
            expect(checkTimePeriodsFormat('0900-1700,1800-2000')).toBe(true);
        });

        it('should return false for invalid time periods', () => {
            expect(checkTimePeriodsFormat('0900-1700,')).toBe(false);
            expect(checkTimePeriodsFormat('09:00-17:00')).toBe(false);
            expect(checkTimePeriodsFormat('900-1700')).toBe(false);
        });
    });

    describe('allTrue', () => {
        it('should return true if all elements are true', () => {
            expect(allTrue([true, true, true])).toBe(true);
        });

        it('should return false if any element is false', () => {
            expect(allTrue([true, false, true])).toBe(false);
        });

        it('should return false for non-array input', () => {
            expect(allTrue('not an array')).toBe(false);
        });
    });

    describe('hashCode32', () => {
        it('should generate a 32-bit integer hash', () => {
            const str = 'hello world';
            // This is the expected hash for 'hello world' from the original C# implementation of this function
            expect(hashCode32(str)).toBe(1794106052);
        });

        it('should generate a different hash for a different string', () => {
            const str1 = 'hello world';
            const str2 = 'hello world!';
            expect(hashCode32(str1)).not.toBe(hashCode32(str2));
        });
    });

    describe('listObjectProperties', () => {
        it('should list sorted keys in name.key=value format', () => {
            const obj = { zebra: 1, apple: 2, mango: 3 };
            const result = listObjectProperties(obj, 'test');
            expect(result).toBe('test.apple=2\ntest.mango=3\ntest.zebra=1\n');
        });

        it('should return empty string for empty object', () => {
            expect(listObjectProperties({}, 'obj')).toBe('');
        });
    });

    describe('cleanOptions', () => {
        it('should set default values for missing general options', () => {
            const options = {};
            cleanOptions(options);
            expect(options.simplified).toBe(true);
            expect(options.numSets).toBe('6');
            expect(options.sync).toBe(false);
            expect(options.theme).toBe('');
        });

        it('should clamp numSets above MAX_SETS (30) down to 30', () => {
            const options = { numSets: '100' };
            cleanOptions(options);
            expect(options.numSets).toBe('30');
        });

        it('should clamp numSets below 1 up to 1', () => {
            const options = { numSets: '0' };
            cleanOptions(options);
            expect(options.numSets).toBe('1');
        });

        it('should set default per-set string options', () => {
            const options = { numSets: '1' };
            cleanOptions(options);
            expect(options.sites1).toBe('');
            expect(options.limitMins1).toBe('');
            expect(options.blockURL1).toBe('blocked.html?$S&$U');
        });

        it('should set default per-set array options', () => {
            const options = { numSets: '1', days1: 'not an array' };
            cleanOptions(options);
            expect(Array.isArray(options.days1)).toBe(true);
            expect(options.days1).toEqual([false, true, true, true, true, true, false]);
        });

        it('should not overwrite already-correct typed options', () => {
            const options = { numSets: '2', theme: 'dark', simplified: false };
            cleanOptions(options);
            expect(options.theme).toBe('dark');
            expect(options.simplified).toBe(false);
        });
    });

    describe('cleanTimeData', () => {
        it('should create a fresh timedata array when none exists', () => {
            const options = { numSets: '1', clockOffset: '0' };
            cleanTimeData(options);
            expect(Array.isArray(options.timedata1)).toBe(true);
            expect(options.timedata1.length).toBe(9);
        });

        it('should extend a short array to TIMEDATA_LEN (else while branch)', () => {
            const options = { numSets: '1', clockOffset: '0', timedata1: [0, 0, 0] };
            cleanTimeData(options);
            expect(options.timedata1.length).toBe(9);
        });

        it('should zero out stale lockdown end time (timedata[4])', () => {
            const pastTime = Math.floor(Date.now() / 1000) - 100;
            const td = new Array(9).fill(0);
            td[4] = pastTime;
            const options = { numSets: '1', clockOffset: '0', timedata1: td };
            cleanTimeData(options);
            expect(options.timedata1[4]).toBe(0);
        });

        it('should preserve active lockdown end time (timedata[4] in future)', () => {
            const futureTime = Math.floor(Date.now() / 1000) + 10000;
            const td = new Array(9).fill(0);
            td[4] = futureTime;
            const options = { numSets: '1', clockOffset: '0', timedata1: td };
            cleanTimeData(options);
            expect(options.timedata1[4]).toBe(futureTime);
        });

        it('should zero out stale minblock end time (timedata[8])', () => {
            const pastTime = Math.floor(Date.now() / 1000) - 100;
            const td = new Array(9).fill(0);
            td[8] = pastTime;
            const options = { numSets: '1', clockOffset: '0', timedata1: td };
            cleanTimeData(options);
            expect(options.timedata1[8]).toBe(0);
        });

        it('should preserve active minblock end time (timedata[8] in future)', () => {
            const futureTime = Math.floor(Date.now() / 1000) + 10000;
            const td = new Array(9).fill(0);
            td[8] = futureTime;
            const options = { numSets: '1', clockOffset: '0', timedata1: td };
            cleanTimeData(options);
            expect(options.timedata1[8]).toBe(futureTime);
        });
    });

    describe('getParsedURL', () => {
        it('should parse a simple URL', () => {
            const result = getParsedURL('https://example.com/path');
            expect(result.protocol).toBe('https');
            expect(result.host).toBe('example.com');
            expect(result.pathNoArgs).toBe('/path');
            expect(result.query).toBeUndefined();
            expect(result.hash).toBeNull();
        });

        it('should parse a URL with query and fragment', () => {
            const result = getParsedURL('https://example.com/page?a=1&b=2#section');
            expect(result.query).toBe('?a=1&b=2');
            expect(result.args).toEqual(['a=1', 'b=2']);
            expect(result.hash).toBe('section');
        });

        it('should parse a URL with port', () => {
            const result = getParsedURL('http://example.com:8080/path');
            expect(result.host).toBe('example.com');
        });

        it('should parse a URL with userinfo', () => {
            const result = getParsedURL('http://user:pass@example.com/path');
            expect(result.host).toBe('example.com');
            expect(result.protocol).toBe('http');
        });

        it('should return null fields for an unparseable URL', () => {
            const result = getParsedURL('not a url');
            expect(result.page).toBeNull();
            expect(result.host).toBeNull();
            expect(result.protocol).toBeNull();
        });
    });

    describe('getRegExpSites', () => {
        it('should return empty strings for null/empty input', () => {
            const result = getRegExpSites('');
            expect(result.block).toBe('');
            expect(result.allow).toBe('');
            expect(result.refer).toBe('');
            expect(result.keyword).toBe('');
        });

        it('should handle FILE pattern for block', () => {
            const result = getRegExpSites('FILE');
            expect(result.block).toBe('^file:');
        });

        it('should handle +FILE pattern for allow', () => {
            const result = getRegExpSites('+FILE');
            expect(result.allow).toBe('^file:');
        });

        it('should handle ~keyword pattern', () => {
            const result = getRegExpSites('~hello');
            expect(result.keyword).toContain('hello');
        });

        it('should handle >referrer pattern', () => {
            const result = getRegExpSites('>example.com');
            expect(result.refer).toContain('example');
        });

        it('should handle +allow pattern', () => {
            const result = getRegExpSites('+example.com');
            expect(result.allow).toContain('example');
        });

        it('should handle normal block pattern', () => {
            const result = getRegExpSites('example.com');
            expect(result.block).toContain('example');
        });

        it('should combine FILE with normal block patterns', () => {
            const result = getRegExpSites('FILE example.com');
            expect(result.block).toContain('file:');
            expect(result.block).toContain('example');
        });

        it('should ignore #comment lines', () => {
            const result = getRegExpSites('#comment.com');
            expect(result.block).toBe('');
        });

        it('should use matchSubdomains in block pattern', () => {
            const withSub = getRegExpSites('example.com', true);
            const noSub = getRegExpSites('example.com', false);
            expect(withSub.block).toContain('[^/]');
            expect(noSub.block).toContain('www');
        });
    });

    describe('patternToRegExp', () => {
        it('should escape special chars and add www prefix', () => {
            const result = patternToRegExp('example.com', false);
            expect(result).toBe('(www\\.)?example\\.com');
        });

        it('should convert * wildcard', () => {
            const result = patternToRegExp('*.example.com', false);
            expect(result).toContain('[^\\/]*');
        });

        it('should convert ** super-wildcard to .*', () => {
            const result = patternToRegExp('**.example.com', false);
            expect(result).toContain('.*');
        });

        it('should convert *+ plus-wildcard to .+', () => {
            const result = patternToRegExp('*+.example.com', false);
            expect(result).toContain('.+');
        });

        it('should remove www. prefix from pattern', () => {
            const withWww = patternToRegExp('www.example.com', false);
            const withoutWww = patternToRegExp('example.com', false);
            expect(withWww).toBe(withoutWww);
        });

        it('should encode unicode characters', () => {
            const result = patternToRegExp('ñoño.com', false);
            expect(result).toContain('%C3%B1');
        });

        it('should use subdomain wildcard when matchSubdomains is true', () => {
            const result = patternToRegExp('example.com', true);
            expect(result).toContain('[^/]*');
            expect(result).not.toContain('(www\\.)?');
        });
    });

    describe('keywordToRegExp', () => {
        it('should return a plain word unchanged', () => {
            expect(keywordToRegExp('hello')).toBe('hello');
        });

        it('should convert underscores to \\s+', () => {
            expect(keywordToRegExp('hello_world')).toBe('hello\\s+world');
        });

        it('should convert * to word chars pattern', () => {
            const result = keywordToRegExp('key*word');
            expect(result).toContain('[\\p{L}\\p{N}]*');
        });

        it('should escape special chars', () => {
            expect(keywordToRegExp('a.b')).toBe('a\\.b');
        });
    });

    describe('checkPosIntFormat', () => {
        it('should return true for empty string', () => {
            expect(checkPosIntFormat('')).toBe(true);
        });

        it('should return true for positive integer', () => {
            expect(checkPosIntFormat('5')).toBe(true);
            expect(checkPosIntFormat('123')).toBe(true);
        });

        it('should return false for zero', () => {
            expect(checkPosIntFormat('0')).toBe(false);
        });

        it('should return false for negative integer', () => {
            expect(checkPosIntFormat('-1')).toBe(false);
        });

        it('should return false for non-numeric string', () => {
            expect(checkPosIntFormat('abc')).toBe(false);
        });
    });

    describe('checkPosNegIntFormat', () => {
        it('should return true for empty string', () => {
            expect(checkPosNegIntFormat('')).toBe(true);
        });

        it('should return true for positive integer', () => {
            expect(checkPosNegIntFormat('5')).toBe(true);
        });

        it('should return true for negative integer', () => {
            expect(checkPosNegIntFormat('-5')).toBe(true);
        });

        it('should return false for zero', () => {
            expect(checkPosNegIntFormat('0')).toBe(false);
        });

        it('should return false for non-numeric string', () => {
            expect(checkPosNegIntFormat('abc')).toBe(false);
        });
    });

    describe('checkPosNumberFormat', () => {
        it('should return true for empty string', () => {
            expect(checkPosNumberFormat('')).toBe(true);
        });

        it('should return true for whole number', () => {
            expect(checkPosNumberFormat('1')).toBe(true);
        });

        it('should return true for decimal less than 1', () => {
            expect(checkPosNumberFormat('0.5')).toBe(true);
        });

        it('should return true for decimal greater than 1', () => {
            expect(checkPosNumberFormat('1.5')).toBe(true);
        });

        it('should return false for zero', () => {
            expect(checkPosNumberFormat('0')).toBe(false);
        });

        it('should return false for negative number', () => {
            expect(checkPosNumberFormat('-1')).toBe(false);
        });
    });

    describe('checkBlockURLFormat', () => {
        it('should return truthy for a valid internal block URL', () => {
            expect(checkBlockURLFormat('blocked.html?$S&$U')).toBeTruthy();
        });

        it('should return truthy for a normal https URL', () => {
            expect(checkBlockURLFormat('https://example.com/block')).toBeTruthy();
        });

        it('should return falsy for an invalid URL', () => {
            expect(checkBlockURLFormat('not a url')).toBeFalsy();
        });
    });

    describe('getMinPeriods', () => {
        it('should return empty array for empty string', () => {
            expect(getMinPeriods('')).toEqual([]);
        });

        it('should parse a single period', () => {
            const result = getMinPeriods('0900-1700');
            expect(result).toEqual([{ start: 540, end: 1020 }]);
        });

        it('should parse multiple periods', () => {
            const result = getMinPeriods('0900-1700,1800-2000');
            expect(result).toEqual([
                { start: 540, end: 1020 },
                { start: 1080, end: 1200 }
            ]);
        });

        it('should skip invalid period entries', () => {
            const result = getMinPeriods('0900-1700,INVALID');
            expect(result).toEqual([{ start: 540, end: 1020 }]);
        });
    });

    describe('cleanTimePeriods', () => {
        it('should return empty string for empty input', () => {
            expect(cleanTimePeriods('')).toBe('');
        });

        it('should return a valid single period unchanged', () => {
            expect(cleanTimePeriods('0900-1700')).toBe('0900-1700');
        });

        it('should sort periods by start time', () => {
            expect(cleanTimePeriods('1800-2000,0900-1700')).toBe('0900-1700,1800-2000');
        });

        it('should merge overlapping periods', () => {
            expect(cleanTimePeriods('0900-1800,1700-2000')).toBe('0900-2000');
        });

        it('should clamp times greater than 2400', () => {
            expect(cleanTimePeriods('0900-2500')).toBe('0900-2400');
        });

        it('should remove zero-duration periods', () => {
            expect(cleanTimePeriods('1700-0900')).toBe('');
        });
    });

    describe('getTimePeriodStart', () => {
        it('should return 0 when limitPeriod is "0"', () => {
            expect(getTimePeriodStart(1000000, "0", 0)).toBe(0);
        });

        it('should return start of hourly period', () => {
            const now = 3600 * 5 + 1800; // 5.5 hours into epoch
            const result = getTimePeriodStart(now, 3600, 0);
            expect(result).toBe(3600 * 5); // start of hour 5
        });

        it('result should be <= now and > now - limitPeriod', () => {
            const now = 1700000000;
            const period = 3600;
            const result = getTimePeriodStart(now, period, 0);
            expect(result).toBeLessThanOrEqual(now);
            expect(result).toBeGreaterThan(now - period);
        });

        it('should apply limitOffset for daily period', () => {
            const now = 1700000000;
            const resultWithOffset = getTimePeriodStart(now, 86400, 1);
            const resultNoOffset = getTimePeriodStart(now, 86400, 0);
            // Both should be within the daily period bounds
            expect(resultWithOffset).toBeLessThanOrEqual(now);
            expect(resultWithOffset).toBeGreaterThan(now - 86400);
            expect(resultNoOffset).toBeLessThanOrEqual(now);
        });

        it('weekly period result should be <= now and > now - week', () => {
            const now = 1700000000;
            const week = 604800;
            const result = getTimePeriodStart(now, week, 0);
            expect(result).toBeLessThanOrEqual(now);
            expect(result).toBeGreaterThan(now - week);
        });
    });

    describe('updateRolloverTime', () => {
        it('should zero out rollover fields when no limit is set', () => {
            const timedata = new Array(9).fill(0);
            timedata[5] = 100;
            timedata[6] = 200;
            timedata[7] = 300;
            updateRolloverTime(timedata, '', '', 1000);
            expect(timedata[5]).toBe(0);
            expect(timedata[6]).toBe(0);
            expect(timedata[7]).toBe(0);
        });

        it('should credit full rollover when timedata[7] < periodStart (new period)', () => {
            const timedata = new Array(9).fill(0);
            timedata[7] = 500; // older than periodStart
            const limitMins = 60;
            const limitPeriod = 3600;
            const periodStart = 1000;
            updateRolloverTime(timedata, limitMins, limitPeriod, periodStart);
            expect(timedata[5]).toBe(limitMins * 60);
            expect(timedata[6]).toBe(limitMins * 60);
            expect(timedata[7]).toBe(periodStart + limitPeriod);
        });

        it('should credit tracked rollover when timedata[7] == periodStart (current period)', () => {
            const timedata = new Array(9).fill(0);
            timedata[6] = 1800; // tracked rollover from previous
            const periodStart = 1000;
            timedata[7] = periodStart;
            const limitMins = 60;
            const limitPeriod = 3600;
            updateRolloverTime(timedata, limitMins, limitPeriod, periodStart);
            expect(timedata[5]).toBe(1800); // takes previous tracked value
            expect(timedata[6]).toBe(limitMins * 60);
            expect(timedata[7]).toBe(periodStart + limitPeriod);
        });

        it('should not modify rollover fields when timedata[7] > periodStart (stale future)', () => {
            const timedata = new Array(9).fill(0);
            timedata[5] = 111;
            timedata[6] = 222;
            timedata[7] = 9999; // future
            updateRolloverTime(timedata, 60, 3600, 1000);
            expect(timedata[5]).toBe(111);
            expect(timedata[6]).toBe(222);
            expect(timedata[7]).toBe(9999);
        });
    });

    describe('encodeDays / decodeDays', () => {
        it('should roundtrip encode then decode', () => {
            const days = [true, false, true, true, false, false, true];
            expect(decodeDays(encodeDays(days))).toEqual(days);
        });

        it('should encode all-true days as 127', () => {
            expect(encodeDays([true, true, true, true, true, true, true])).toBe(127);
        });

        it('should encode all-false days as 0', () => {
            expect(encodeDays([false, false, false, false, false, false, false])).toBe(0);
        });

        it('should decode 0 as all-false', () => {
            expect(decodeDays(0)).toEqual([false, false, false, false, false, false, false]);
        });
    });

    describe('createAccessCode', () => {
        it('should return a string of the specified length', () => {
            expect(createAccessCode(10)).toHaveLength(10);
            expect(createAccessCode(5)).toHaveLength(5);
        });

        it('should not contain ambiguous characters O, 0, I, l', () => {
            const code = createAccessCode(200);
            expect(code).not.toMatch(/[O0Il]/);
        });
    });

    describe('setTheme', () => {
        let link;
        beforeEach(() => {
            link = document.createElement('link');
            link.id = 'themeLink';
            document.head.appendChild(link);
        });
        afterEach(() => {
            link.remove();
        });

        it('should set href to the specified theme css', () => {
            setTheme('dark');
            expect(link.getAttribute('href')).toBe('/themes/dark.css');
        });

        it('should fall back to default.css when theme is null', () => {
            setTheme(null);
            expect(link.getAttribute('href')).toBe('/themes/default.css');
        });

        it('should fall back to default.css when theme is empty string', () => {
            setTheme('');
            expect(link.getAttribute('href')).toBe('/themes/default.css');
        });

        it('should do nothing when no themeLink element exists', () => {
            link.remove();
            expect(() => setTheme('dark')).not.toThrow();
            document.head.appendChild(link); // restore for afterEach
        });
    });

    describe('localize', () => {
        beforeEach(() => {
            global.browser = {
                i18n: {
                    getMessage: jest.fn(key => `[${key}]`)
                }
            };
        });

        it('should set textContent for data-i18n elements', () => {
            document.body.innerHTML = '<span data-i18n="hello_key"></span>';
            localize();
            expect(document.querySelector('[data-i18n]').textContent).toBe('[hello_key]');
        });

        it('should set innerHTML for data-i18n-html elements', () => {
            document.body.innerHTML = '<div data-i18n-html="link_key"></div>';
            localize();
            expect(document.querySelector('[data-i18n-html]').innerHTML).toBe('[link_key]');
        });

        it('should set placeholder for data-i18n-placeholder elements', () => {
            document.body.innerHTML = '<input data-i18n-placeholder="ph_key" />';
            localize();
            expect(document.querySelector('[data-i18n-placeholder]').placeholder).toBe('[ph_key]');
        });

        it('should set title for data-i18n-title elements', () => {
            document.body.innerHTML = '<button data-i18n-title="title_key"></button>';
            localize();
            expect(document.querySelector('[data-i18n-title]').title).toBe('[title_key]');
        });

        it('should not set content when getMessage returns empty string', () => {
            global.browser.i18n.getMessage = jest.fn(() => '');
            document.body.innerHTML = '<span data-i18n="missing_key">original</span>';
            localize();
            expect(document.querySelector('[data-i18n]').textContent).toBe('original');
        });
    });

    describe('getTimestampSuffix', () => {
        it('should return a string matching the timestamp pattern', () => {
            const suffix = getTimestampSuffix();
            expect(suffix).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
        });

        it('should return a string of length 19', () => {
            expect(getTimestampSuffix()).toHaveLength(19);
        });
    });
});
