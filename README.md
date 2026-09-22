# DeepWiki Bookmarker

<p align="center">
  <img src="public/icons/logo.png" alt="DeepWiki Bookmarker Logo" width="160" />
</p>

DeepWiki Bookmarker (`dwb`) is a Chrome extension that organizes your DeepWiki
repositories and search sessions in a side panel while you browse normal tabs.

> [!NOTE]
> This is an **unofficial** app for Devin, and is not endorsed, provided, or supported by the developers of Devin.

## Installation

Requires Chrome 116 or newer.

1. Download the Chrome ZIP from [Releases](https://github.com/ynqa/dwb/releases/latest) and extract it, or build from source below.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the extracted folder containing `manifest.json` (or the local `dist` folder).
4. Pin **DeepWiki Bookmarker** to the toolbar and click its icon to open the side panel.

## Usage

- Visit a repository on `https://deepwiki.com` to save it automatically.
- Start a search from that repository; its `/search/...` sessions are saved under it.
- Tracking continues with the panel closed. Each tab keeps its own repository context, including across service worker restarts.
- Click a saved repository or session to revisit it. An active DeepWiki tab is reused; from other sites, a new tab opens.
- Expand repository groups to see sessions. Right-click to rename sessions or delete entries.
- A session opened directly without a known repository cannot be assigned automatically. Visit its repository first and then open the session in the same tab.
- Returning to the DeepWiki home page or leaving the site clears that tab's repository context. Deleting a bookmark leaves the current page open; visiting it again records it again.

## Storage and permissions

Bookmarks are stored locally in `chrome.storage.local`; temporary per-tab repository
context uses `chrome.storage.session`. Nothing is sent to an external service and
bookmarks are not synced between devices. Uninstalling the extension removes its data.
Existing desktop-app data is not imported automatically.

- `sidePanel`: show the bookmark sidebar.
- `storage`: persist bookmarks and per-tab context.
- `webNavigation`: detect page navigation and SPA URL changes, and clear context when leaving DeepWiki. Only DeepWiki repository/session URLs are saved.
- `https://deepwiki.com/*`: identify and reuse DeepWiki tabs.

Uses [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3),
[Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel),
[Web Navigation](https://developer.chrome.com/docs/extensions/reference/api/webNavigation),
and [Storage](https://developer.chrome.com/docs/extensions/reference/api/storage) APIs.

## Development

Requires Node.js 22+ and pnpm 10.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Load `dist` as an unpacked extension. For iterative development, run
`pnpm dev:extension`, reload the extension in `chrome://extensions`, and reopen the
panel after changes. `pnpm dev` provides a UI-only browser preview without Chrome
extension APIs.

### UI and browser integration

The bookmark UI and native side panel presentation are separate:

- `src/Dashboard.tsx`, `src/hooks`, and `src/lib` contain the UI and DeepWiki
  behavior. They use the browser-independent `PanelClient` interface in
  `src/panel/PanelClient.ts`; they do not call extension APIs.
- `src/extension/panelClient.ts` implements bookmark storage, worker messages,
  and tab navigation for the UI. `src/main.tsx` injects this client (or the
  development preview client) into the dashboard.
- `src/extension/bookmarkWorker.ts` tracks navigation and serializes bookmark
  writes independently of any open UI.
- `src/extension/nativeSidePanel.ts` only configures the browser's native
  `sidePanel` behavior. `src/extension/background.ts` connects it and the worker
  at startup. A missing, rejected, or unresponsive side panel API does not block
  bookmark initialization or edits.

An alternative presentation can reuse the dashboard and provide a `PanelClient`
with navigation appropriate to its browsing context. This separation does not
add an automatic tab/window fallback or make unsupported native side panels work.
The packaged extension still opens through the browser's native Side Panel API.

Keep versions in `package.json` and `public/manifest.json` in sync. CI runs tests and
uploads the built `dist` folder as an artifact. GitHub releases and Chrome Web
Store publishing are manual. Store installations use Chrome's extension updates;
unpacked installations must be rebuilt/reloaded manually.
