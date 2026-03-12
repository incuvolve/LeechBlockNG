/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function log(message) { console.log("[ivBlock] " + message); }
function warn(message) { console.warn("[ivBlock] " + message); }

var gOptions;

// Initialize form
//
function initForm() {
	//log("initForm");

	// Set up event listener
	$("#testURL").click(testURL);

	// Clear text fields
	$("#url").val("");
	$("#results").val("");
}

// Initialize page
//
function initializePage() {
	//log("initializePage");

	localize();

	browser.storage.local.get("sync").then(onGotSync, onError);

	function onGotSync(options) {
		if (options["sync"]) {
			browser.storage.sync.get().then(onGot, onError);
		} else {
			browser.storage.local.get().then(onGot, onError);
		}
	}

	function onGot(options) {
		gOptions = options;

		cleanOptions(gOptions);

		// Initialize form
		initForm();

		setTheme(gOptions["theme"]);
	}

	function onError(error) {
		warn("Cannot get options: " + error);
		alert("Error: Unable to retrieve options from browser storage.");
	}
}

// Test URL
//
function testURL() {
	if (!gOptions) return;

	let url = $("#url").val();

	// Check URL format
	if (!getParsedURL(url).page) {
		alert("Please enter the URL in the correct format (as a fully specified URL).");
		return;
	}

	// Generate results for regexp matches
	let results = "";
	let numSets = gOptions["numSets"];
	for (let set = 1; set <= numSets; set++) {
		// Add header
		let setName = gOptions[`setName${set}`];
		let header = setName
			? `====== Block Set ${set} (${setName})\n`
			: `====== Block Set ${set}\n`;
		results += header;

		// Add result for block
		let blockRE = gOptions[`regexpBlock${set}`] || gOptions[`blockRE${set}`];
		if (blockRE) {
			let res = new RegExp(blockRE, "i").exec(url);
			if (res) {
				results += `BLOCK: ${res[0]}\n`;
			} else {
				results += "BLOCK: -\n";
			}
		}

		// Add result for allow
		let allowRE = gOptions[`regexpAllow${set}`] || gOptions[`allowRE${set}`];
		if (allowRE) {
			let res = new RegExp(allowRE, "i").exec(url);
			if (res) {
				results += `ALLOW: ${res[0]}\n`;
			} else {
				results += "ALLOW: -\n";
			}
		}

		// Add result for refer
		let referRE = gOptions[`referRE${set}`];
		if (referRE) {
			let res = new RegExp(referRE, "i").exec(url);
			if (res) {
				results += `REFER: ${res[0]}\n`;
			} else {
				results += "REFER: -\n";
			}
		}

		results += "\n";
	}

	$("#results").val(results);
}

/*** STARTUP CODE BEGINS HERE ***/

document.addEventListener("DOMContentLoaded", initializePage);

// Expose functions for testing purposes
window.initForm = initForm;
window.initializePage = initializePage;
window.testURL = testURL;
