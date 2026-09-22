import type { PanelClient } from "@/panel/PanelClient";
import type { BrowserPlatform } from "@/platform/BrowserPlatform";
import { HOME_ORIGIN } from "./constants";
import {
	parsePersistedRepositories,
	REPOSITORIES_STORAGE_KEY,
} from "./repositoryPersistence";

export function createDeepWikiPanelClient(
	browser: BrowserPlatform,
): PanelClient {
	const activeTab = async () => {
		const [tab] = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		return tab;
	};
	return {
		bookmarks: {
			async read() {
				await browser.messages.send({ type: "initialize" });
				const data = await browser.storage.local.get(REPOSITORIES_STORAGE_KEY);
				return parsePersistedRepositories(data[REPOSITORIES_STORAGE_KEY]);
			},
			subscribe(listener) {
				return browser.storage.local.subscribe(
					REPOSITORIES_STORAGE_KEY,
					(value) => listener(parsePersistedRepositories(value)),
				);
			},
			execute: (command) => browser.messages.send(command),
		},
		navigation: {
			async readUrl() {
				return (await activeTab())?.url ?? "";
			},
			subscribe: (listener) => browser.tabs.onChanged(listener),
			async openUrl(url) {
				if (new URL(url).origin !== HOME_ORIGIN)
					throw new Error("Only DeepWiki URLs can be opened.");
				const tab = await activeTab();
				// Reusing a tab is a DeepWiki policy, not a browser adapter decision.
				if (
					tab?.id !== undefined &&
					tab.url &&
					new URL(tab.url).origin === HOME_ORIGIN
				) {
					await browser.tabs.update(tab.id, url);
				} else {
					await browser.tabs.create(url, tab?.windowId);
				}
			},
		},
	};
}
