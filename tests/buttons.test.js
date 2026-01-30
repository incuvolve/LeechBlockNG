const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const optionsHtmlPath = path.resolve(__dirname, '../options.html');
const optionsHtml = fs.readFileSync(optionsHtmlPath, 'utf8');

let dom;
let document;

describe('Button Style Tests', () => {
    beforeEach(() => {
        dom = new JSDOM(optionsHtml);
        document = dom.window.document;
    });

    it('should have consistent button classes', () => {
        const buttons = document.querySelectorAll('button');
        const unstyledButtons = [];

        buttons.forEach(button => {
            const hasIvBlockButtonClass = button.classList.contains('ivblock-button');
            const hasUiButtonClass = button.classList.contains('ui-button'); // jquery-ui buttons

            if (!hasIvBlockButtonClass && !hasUiButtonClass) {
                // Collect IDs of buttons that don't have the required classes
                unstyledButtons.push(button.id || 'no-id');
            }
        });

        // The test fails if there are any unstyled buttons
        expect(unstyledButtons).toEqual([]);
    });
});
