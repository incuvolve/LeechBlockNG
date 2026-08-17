# Safari Tab Focus Issue - Fix Documentation

**Date:** 2026-08-17  
**Files Modified:** `background.js`  
**Issue:** Clicking links in blocked.html causes focus to jump to wrong tab in Safari

## Problem Description

When a user clicked on a link in `blocked.html` (delayed or password page), Safari would switch focus to a random or incorrect tab instead of staying on the tab that was loading the blocked URL.

### Root Cause

Safari has unique tab ID handling behavior for extension pages:

1. When navigating from an extension page (e.g., `blocked.html`) to a regular web page, Safari assigns a **new tab ID** to the tab
2. The old tab ID is removed, triggering the `handleTabRemoved` event
3. The previous code would **always** switch focus to `gPrevActiveTabId` when any extension page was closed
4. Since tabs could be created/closed between when the blocked page was shown and when the link was clicked, `gPrevActiveTabId` often pointed to the wrong tab

### Code Flow

```
User clicks link in blocked.html
  ↓
blocked.js: window.location.href = capturedURL
  ↓
Safari navigates & assigns NEW tab ID
  ↓
Safari removes OLD tab ID → handleTabRemoved(oldTabId)
  ↓
OLD CODE: browser.tabs.update(gPrevActiveTabId, { active: true })
  ↓
Focus jumps to WRONG tab (stale gPrevActiveTabId)
```

## Solution

Modified `handleTabRemoved()` in `background.js` to **skip focus switching** when the removed tab is a blocked/delayed/password page being navigated away from.

### Changes to `background.js` (lines ~1976-2001)

```javascript
function handleTabRemoved(tabId, removeInfo) {
	if (!gGotOptions) {
		return;
	}

	clockPageTime(tabId, false, false);

	// If extension page closed, activate previously active tab
	// UNLESS it's a blocked/delayed/password page being navigated away from
	// (Safari assigns a new tab ID when navigating from extension to web page,
	// so the old ID is removed — we don't want to switch focus in that case)
	if (gTabs[tabId] && gTabs[tabId].url.startsWith(EXTENSION_URL)) {
		let url = gTabs[tabId].url;
		let isBlockPage = url.includes("blocked.html") || 
		                  url.includes("delayed.html") || 
		                  url.includes("password.html");
		
		// Only switch focus if it's NOT a block page
		if (!isBlockPage && gPrevActiveTabId) {
			browser.tabs.update(gPrevActiveTabId, { active: true });
		}
	}

	if (gTabs[tabId]) {
		delete gTabs[tabId];
	}
}
```

## Result

- ✅ Clicking links in blocked.html now keeps focus on the correct tab
- ✅ Safari no longer crashes (previous fix)
- ✅ Other extension pages (options, stats, etc.) still correctly restore focus when closed

## Related Safari Workarounds

This extension has several Safari-specific workarounds due to tab ID handling:

1. **`gDelayAllowances`** (background.js ~line 1594) - Host+set allowances independent of tab ID
2. **`gDelayedTabIds`** (background.js ~line 1825) - Mapping of blocked URLs to correct tab IDs
3. **`browser.tabs.getCurrent()`** (blocked.js ~line 200) - Get reliable tab ID for extension pages
4. **This fix** - Skip focus switch when navigating from block pages
