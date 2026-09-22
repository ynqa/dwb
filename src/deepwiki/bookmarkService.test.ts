import { describe, expect, it, vi } from "vitest";
import type {
	BrowserPlatform,
	BrowserTab,
	StorageArea,
} from "@/platform/BrowserPlatform";
import { startBookmarkService } from "./bookmarkService";
import { createDeepWikiPanelClient } from "./panelClient";

function event<T extends unknown[]>() {
	const listeners = new Set<(...args: T) => void>();
	return {
		subscribe(listener: (...args: T) => void) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		emit(...args: T) {
			for (const listener of listeners) listener(...args);
		},
	};
}

function memoryStorage(): StorageArea {
	const values: Record<string, unknown> = {};
	const changed = event<[string, unknown]>();
	return {
		async get(key) {
			return structuredClone(key === null ? values : { [key]: values[key] });
		},
		async set(data) {
			for (const [key, value] of Object.entries(data)) {
				values[key] = structuredClone(value);
				changed.emit(key, structuredClone(value));
			}
		},
		async remove(keys) {
			for (const key of [keys].flat()) {
				delete values[key];
				changed.emit(key, undefined);
			}
		},
		subscribe(key, listener) {
			return changed.subscribe((changedKey, value) => {
				if (key === changedKey) listener(value);
			});
		},
	};
}

// No extension APIs or vendor-specific types: the application runs on these ports.
function memoryBrowser() {
	const navigated = event<[number, string]>();
	const created = event<[number, number, string]>();
	const removed = event<[number]>();
	const changed = event<[]>();
	const ready = event<[]>();
	let receiver: ((value: unknown) => Promise<void>) | undefined;
	const browser: BrowserPlatform = {
		storage: { local: memoryStorage(), session: memoryStorage() },
		tabs: {
			query: vi.fn(async (): Promise<BrowserTab[]> => []),
			update: vi.fn(async () => {}),
			create: vi.fn(async () => {}),
			onChanged: changed.subscribe,
			onRemoved: removed.subscribe,
		},
		navigation: {
			onNavigated: navigated.subscribe,
			onCreatedTarget: created.subscribe,
		},
		lifecycle: { onReady: ready.subscribe },
		messages: {
			async send(message) {
				if (!receiver) throw new Error("Service not running");
				await receiver(message);
			},
			listen(accepts, handler) {
				receiver = async (message) => {
					if (!accepts(message)) throw new Error("Invalid command");
					await handler(message);
				};
				return () => {
					receiver = undefined;
				};
			},
		},
	};
	return { browser, navigated, created, removed, ready };
}

describe("DeepWiki application without an extension", () => {
	it("tracks simultaneous tabs, persists context across restarts, and edits bookmarks", async () => {
		const { browser, navigated, created, removed } = memoryBrowser();
		const stop = startBookmarkService(browser);
		const client = createDeepWikiPanelClient(browser);
		navigated.emit(1, "https://deepwiki.com/owner/a");
		navigated.emit(2, "https://deepwiki.com/owner/b");
		navigated.emit(1, "https://deepwiki.com/search/a");
		navigated.emit(2, "https://deepwiki.com/search/b");
		const store = await client.bookmarks.read();
		expect([...store.keys()]).toEqual(["owner/a", "owner/b"]);
		expect(store.get("owner/a")?.has("https://deepwiki.com/search/a")).toBe(
			true,
		);
		expect(store.get("owner/b")?.has("https://deepwiki.com/search/b")).toBe(
			true,
		);
		stop();
		const stopAgain = startBookmarkService(browser);
		created.emit(1, 3, "https://deepwiki.com/search/new");
		await client.bookmarks.execute({
			type: "rename-session",
			url: "https://deepwiki.com/search/new",
			alias: "Notes",
		});
		expect(
			(await client.bookmarks.read())
				.get("owner/a")
				?.get("https://deepwiki.com/search/new")?.alias,
		).toBe("Notes");
		removed.emit(3);
		navigated.emit(3, "https://deepwiki.com/search/unowned");
		await client.bookmarks.execute({
			type: "delete-repository",
			slug: "owner/a",
		});
		expect([...(await client.bookmarks.read()).keys()]).toEqual(["owner/b"]);
		expect(await browser.storage.session.get(null)).toEqual({
			"dwb.tab.2": "owner/b",
		});
		stopAgain();
	});
	it("decides whether to reuse a tab before calling browser operations", async () => {
		const { browser } = memoryBrowser();
		const client = createDeepWikiPanelClient(browser);
		const url = "https://deepwiki.com/owner/next";
		vi.mocked(browser.tabs.query).mockResolvedValue([
			{ id: 7, windowId: 3, url: "https://deepwiki.com/owner/repo" },
		]);
		await client.navigation.openUrl(url);
		expect(browser.tabs.update).toHaveBeenCalledWith(7, url);
		vi.mocked(browser.tabs.query).mockResolvedValue([
			{ id: 8, windowId: 3, url: "https://example.com" },
		]);
		await client.navigation.openUrl(url);
		expect(browser.tabs.create).toHaveBeenCalledWith(url, 3);
		await expect(
			client.navigation.openUrl("https://example.com"),
		).rejects.toThrow("Only DeepWiki URLs");
		expect(browser.tabs.create).toHaveBeenCalledTimes(1);
	});
});
