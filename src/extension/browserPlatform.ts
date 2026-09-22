import type { BrowserPlatform, StorageArea } from "@/platform/BrowserPlatform";

export function createBrowserPlatform(
	api: Pick<typeof chrome, "runtime" | "storage" | "tabs" | "webNavigation">,
): BrowserPlatform {
	function storage(area: "local" | "session"): StorageArea {
		return {
			get: (key) => api.storage[area].get(key),
			set: (values) => api.storage[area].set(values),
			remove: (keys) => api.storage[area].remove(keys),
			subscribe(key, listener) {
				const onChanged = (
					changes: Record<string, chrome.storage.StorageChange>,
					changedArea: string,
				) => {
					if (changedArea === area && changes[key])
						listener(changes[key].newValue);
				};
				api.storage.onChanged.addListener(onChanged);
				return () => api.storage.onChanged.removeListener(onChanged);
			},
		};
	}
	return {
		storage: { local: storage("local"), session: storage("session") },
		tabs: {
			query: (query) => api.tabs.query(query),
			async update(tabId, url) {
				await api.tabs.update(tabId, { url });
			},
			async create(url, windowId) {
				await api.tabs.create({
					url,
					...(windowId !== undefined ? { windowId } : {}),
				});
			},
			onChanged(listener) {
				api.tabs.onActivated.addListener(listener);
				api.tabs.onUpdated.addListener(listener);
				return () => {
					api.tabs.onActivated.removeListener(listener);
					api.tabs.onUpdated.removeListener(listener);
				};
			},
			onRemoved(listener) {
				api.tabs.onRemoved.addListener(listener);
				return () => api.tabs.onRemoved.removeListener(listener);
			},
		},
		navigation: {
			onNavigated(listener) {
				const onNavigation = (details: {
					tabId: number;
					frameId: number;
					url: string;
					documentLifecycle?: string;
				}) => {
					if (
						details.frameId !== 0 ||
						(details.documentLifecycle &&
							details.documentLifecycle !== "active")
					)
						return;
					listener(details.tabId, details.url);
				};
				api.webNavigation.onCommitted.addListener(onNavigation);
				api.webNavigation.onHistoryStateUpdated.addListener(onNavigation);
				return () => {
					api.webNavigation.onCommitted.removeListener(onNavigation);
					api.webNavigation.onHistoryStateUpdated.removeListener(onNavigation);
				};
			},
			onCreatedTarget(listener) {
				const onCreated = (
					details: chrome.webNavigation.WebNavigationSourceCallbackDetails,
				) => {
					if (details.sourceFrameId === 0)
						listener(details.sourceTabId, details.tabId, details.url);
				};
				api.webNavigation.onCreatedNavigationTarget.addListener(onCreated);
				return () =>
					api.webNavigation.onCreatedNavigationTarget.removeListener(onCreated);
			},
		},
		lifecycle: {
			onReady(listener) {
				api.runtime.onInstalled.addListener(listener);
				api.runtime.onStartup.addListener(listener);
				return () => {
					api.runtime.onInstalled.removeListener(listener);
					api.runtime.onStartup.removeListener(listener);
				};
			},
		},
		messages: {
			async send(message) {
				const result = await api.runtime.sendMessage(message);
				if (!result?.ok)
					throw new Error(result?.error ?? "The extension did not respond.");
			},
			listen(accepts, handler) {
				const onMessage = (
					message: unknown,
					sender: chrome.runtime.MessageSender,
					sendResponse: (response: unknown) => void,
				) => {
					if (
						sender.id !== api.runtime.id ||
						!sender.url?.startsWith(api.runtime.getURL("")) ||
						!accepts(message)
					)
						return false;
					// Invoke immediately so commands retain their order with navigation events.
					void (async () => {
						try {
							await handler(message);
							sendResponse({ ok: true });
						} catch (error) {
							sendResponse({ ok: false, error: String(error) });
						}
					})();
					return true;
				};
				api.runtime.onMessage.addListener(onMessage);
				return () => api.runtime.onMessage.removeListener(onMessage);
			},
		},
	};
}
