import { HOME_ORIGIN } from "@/lib/constants";
import { setSessionAlias, type RepositoryStore } from "@/lib/repository";
import {
	deleteRepositoryFromStore,
	deleteSessionFromStore,
	parsePersistedRepositories,
	REPOSITORIES_STORAGE_KEY,
	serializeRepositories,
} from "@/lib/repositoryPersistence";
import { isCommand, type ExtensionCommand } from "./messages";
import { trackNavigation } from "./tracking";

const contextKey = (tabId: number) => `dwb.tab.${tabId}`;
// Every read/modify/write goes through this queue, including panel edits.
// Only the worker writes bookmarks, so simultaneous tabs cannot overwrite them.
let pending = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const result = pending.then(task);
	pending = result.then(
		() => undefined,
		(error) => console.error("dwb:", error),
	);
	return result;
}
async function loadStore() {
	const data = await chrome.storage.local.get(REPOSITORIES_STORAGE_KEY);
	return parsePersistedRepositories(data[REPOSITORIES_STORAGE_KEY]);
}
async function saveStore(store: RepositoryStore) {
	await chrome.storage.local.set({
		[REPOSITORIES_STORAGE_KEY]: serializeRepositories(store),
	});
}
async function track(tabId: number, url: string) {
	const key = contextKey(tabId);
	const data = await chrome.storage.session.get(key);
	const context = typeof data[key] === "string" ? data[key] : null;
	// Outside DeepWiki we only discard the per-tab context; no URL is stored.
	if (!url.startsWith(`${HOME_ORIGIN}/`) && url !== HOME_ORIGIN) {
		if (context) await chrome.storage.session.remove(key);
		return;
	}
	const store = await loadStore();
	const next = trackNavigation(store, context, url);
	if (next.store !== store) await saveStore(next.store);
	if (next.context) await chrome.storage.session.set({ [key]: next.context });
	else await chrome.storage.session.remove(key);
}
function onNavigation(details: {
	tabId: number;
	frameId: number;
	url: string;
	documentLifecycle?: string;
}) {
	if (
		details.frameId !== 0 ||
		(details.documentLifecycle && details.documentLifecycle !== "active")
	)
		return;
	void enqueue(() => track(details.tabId, details.url)).catch(() => {});
}
chrome.webNavigation.onCommitted.addListener(onNavigation);
chrome.webNavigation.onHistoryStateUpdated.addListener(onNavigation);
chrome.tabs.onRemoved.addListener((tabId) => {
	void enqueue(() => chrome.storage.session.remove(contextKey(tabId))).catch(
		() => {},
	);
});
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
	if (details.sourceFrameId !== 0 || !details.url.startsWith(`${HOME_ORIGIN}/`))
		return;
	void enqueue(async () => {
		const key = contextKey(details.sourceTabId);
		const data = await chrome.storage.session.get(key);
		if (typeof data[key] === "string") {
			await chrome.storage.session.set({
				[contextKey(details.tabId)]: data[key],
			});
		}
		await track(details.tabId, details.url);
	}).catch(() => {});
});
async function initialize() {
	const tabs = await chrome.tabs.query({ url: `${HOME_ORIGIN}/*` });
	for (const tab of tabs) {
		if (tab.id !== undefined && tab.url) await track(tab.id, tab.url);
	}
}
chrome.runtime.onInstalled.addListener(() => {
	void enqueue(initialize).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
	void enqueue(initialize).catch(() => {});
});

async function handleCommand(command: ExtensionCommand) {
	if (command.type === "initialize") {
		// Queue barrier only. Opening a UI must not re-record deleted bookmarks
		// or depend on how the browser displays that UI.
		return;
	}
	const store = await loadStore();
	let next = store;
	switch (command.type) {
		case "rename-session":
			next = setSessionAlias(store, command.url, command.alias);
			break;
		case "delete-session":
			next = deleteSessionFromStore(store, command.slug, command.url);
			break;
		case "delete-repository": {
			next = deleteRepositoryFromStore(store, command.slug);
			const contexts = await chrome.storage.session.get(null);
			const keys = Object.keys(contexts).filter(
				(key) => key.startsWith("dwb.tab.") && contexts[key] === command.slug,
			);
			if (keys.length) await chrome.storage.session.remove(keys);
			break;
		}
	}
	if (next !== store) await saveStore(next);
}
chrome.runtime.onMessage.addListener(
	(message: unknown, sender, sendResponse) => {
		// Only extension pages can edit saved bookmarks.
		if (
			sender.id !== chrome.runtime.id ||
			!sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}/`) ||
			!isCommand(message)
		)
			return false;
		void enqueue(() => handleCommand(message)).then(
			() => sendResponse({ ok: true }),
			(error) => sendResponse({ ok: false, error: String(error) }),
		);
		return true;
	},
);
