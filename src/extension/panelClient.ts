import {
	parsePersistedRepositories,
	REPOSITORIES_STORAGE_KEY,
} from "@/lib/repositoryPersistence";
import type { PanelClient } from "@/panel/PanelClient";
import type { ExtensionCommand } from "./messages";

// No sidePanel dependency: the same client works in extension tabs/windows.
export function createExtensionPanelClient(
	api: Pick<typeof chrome, "runtime" | "storage" | "tabs">,
): PanelClient {
	async function sendCommand(command: ExtensionCommand) {
		const result = await api.runtime.sendMessage(command);
		if (!result?.ok)
			throw new Error(result?.error ?? "The extension did not respond.");
	}
	const activeTab = async () => {
		const [tab] = await api.tabs.query({ active: true, currentWindow: true });
		return tab;
	};
	return {
		bookmarks: {
			async read() {
				// Wait for pending worker writes before taking the initial snapshot.
				await sendCommand({ type: "initialize" });
				const data = await api.storage.local.get(REPOSITORIES_STORAGE_KEY);
				return parsePersistedRepositories(data[REPOSITORIES_STORAGE_KEY]);
			},
			subscribe(listener) {
				const onChanged = (
					changes: Record<string, chrome.storage.StorageChange>,
					area: string,
				) => {
					if (area === "local" && changes[REPOSITORIES_STORAGE_KEY]) {
						listener(
							parsePersistedRepositories(
								changes[REPOSITORIES_STORAGE_KEY].newValue,
							),
						);
					}
				};
				api.storage.onChanged.addListener(onChanged);
				return () => api.storage.onChanged.removeListener(onChanged);
			},
			execute: sendCommand,
		},
		navigation: {
			async readUrl() {
				return (await activeTab())?.url ?? "";
			},
			subscribe(listener) {
				api.tabs.onActivated.addListener(listener);
				api.tabs.onUpdated.addListener(listener);
				return () => {
					api.tabs.onActivated.removeListener(listener);
					api.tabs.onUpdated.removeListener(listener);
				};
			},
			async openUrl(url, reuseOrigin) {
				const tab = await activeTab();
				if (
					tab?.id !== undefined &&
					tab.url &&
					new URL(tab.url).origin === reuseOrigin
				) {
					await api.tabs.update(tab.id, { url });
				} else {
					await api.tabs.create({
						url,
						...(tab ? { windowId: tab.windowId } : {}),
					});
				}
			},
		},
	};
}
