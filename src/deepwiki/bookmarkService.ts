import type { BrowserPlatform } from "@/platform/BrowserPlatform";
import { HOME_ORIGIN } from "./constants";
import { isCommand, type BookmarkCommand } from "./messages";
import { setSessionAlias, type RepositoryStore } from "./repository";
import {
	deleteRepositoryFromStore,
	deleteSessionFromStore,
	parsePersistedRepositories,
	REPOSITORIES_STORAGE_KEY,
	serializeRepositories,
} from "./repositoryPersistence";
import { trackNavigation } from "./tracking";

const contextKey = (tabId: number) => `dwb.tab.${tabId}`;
const isDeepWiki = (url: string) =>
	url === HOME_ORIGIN || url.startsWith(`${HOME_ORIGIN}/`);

// Owns DeepWiki rules and serializes every write, regardless of browser or UI.
export function startBookmarkService(browser: BrowserPlatform) {
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
		const data = await browser.storage.local.get(REPOSITORIES_STORAGE_KEY);
		return parsePersistedRepositories(data[REPOSITORIES_STORAGE_KEY]);
	}
	async function saveStore(store: RepositoryStore) {
		await browser.storage.local.set({
			[REPOSITORIES_STORAGE_KEY]: serializeRepositories(store),
		});
	}
	async function track(tabId: number, url: string) {
		const key = contextKey(tabId);
		const data = await browser.storage.session.get(key);
		const context = typeof data[key] === "string" ? data[key] : null;
		if (!isDeepWiki(url)) {
			if (context) await browser.storage.session.remove(key);
			return;
		}
		const store = await loadStore();
		const next = trackNavigation(store, context, url);
		if (next.store !== store) await saveStore(next.store);
		if (next.context)
			await browser.storage.session.set({ [key]: next.context });
		else await browser.storage.session.remove(key);
	}
	async function initialize() {
		const tabs = await browser.tabs.query({ url: `${HOME_ORIGIN}/*` });
		for (const tab of tabs) {
			if (tab.id !== undefined && tab.url) await track(tab.id, tab.url);
		}
	}
	async function handleCommand(command: BookmarkCommand) {
		// Queue barrier only: opening the UI must not re-record deleted bookmarks.
		if (command.type === "initialize") return;
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
				const contexts = await browser.storage.session.get(null);
				const keys = Object.keys(contexts).filter(
					(key) => key.startsWith("dwb.tab.") && contexts[key] === command.slug,
				);
				if (keys.length) await browser.storage.session.remove(keys);
				break;
			}
		}
		if (next !== store) await saveStore(next);
	}
	const unsubscribe = [
		browser.navigation.onNavigated((tabId, url) => {
			void enqueue(() => track(tabId, url)).catch(() => {});
		}),
		browser.tabs.onRemoved((tabId) => {
			void enqueue(() =>
				browser.storage.session.remove(contextKey(tabId)),
			).catch(() => {});
		}),
		browser.navigation.onCreatedTarget((sourceTabId, tabId, url) => {
			if (!isDeepWiki(url)) return;
			void enqueue(async () => {
				const key = contextKey(sourceTabId);
				const data = await browser.storage.session.get(key);
				if (typeof data[key] === "string")
					await browser.storage.session.set({ [contextKey(tabId)]: data[key] });
				await track(tabId, url);
			}).catch(() => {});
		}),
		browser.lifecycle.onReady(() => {
			void enqueue(initialize).catch(() => {});
		}),
		browser.messages.listen(isCommand, (command) =>
			enqueue(() => handleCommand(command)),
		),
	];
	return () => {
		for (const dispose of unsubscribe) dispose();
	};
}
