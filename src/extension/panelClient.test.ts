import { describe, expect, it, vi } from "vitest";
import { openDeepWiki } from "@/hooks/useActiveTab";
import { REPOSITORIES_STORAGE_KEY } from "@/lib/repositoryPersistence";
import { createExtensionPanelClient } from "./panelClient";

function event() {
	const listeners = new Set<(...args: any[]) => void>();
	return {
		addListener: (listener: (...args: any[]) => void) =>
			listeners.add(listener),
		removeListener: (listener: (...args: any[]) => void) =>
			listeners.delete(listener),
		emit: (...args: any[]) => {
			for (const listener of listeners) listener(...args);
		},
	};
}

function setup() {
	// Deliberately has no sidePanel API.
	const api = {
		runtime: {
			sendMessage: vi.fn(async (_command: unknown) => ({ ok: true })),
		},
		storage: {
			local: {
				get: vi.fn(async (_key: string) => ({
					[REPOSITORIES_STORAGE_KEY]: {
						version: 1,
						repositories: [{ slug: "owner/repo", sessions: [] }],
					},
				})),
			},
			onChanged: event(),
		},
		tabs: {
			query: vi.fn(async (_query: unknown) => [
				{ id: 1, windowId: 2, url: "https://deepwiki.com/owner/repo" },
			]),
			update: vi.fn(async (_id: number, _options: unknown) => {}),
			create: vi.fn(async (_options: unknown) => {}),
			onActivated: event(),
			onUpdated: event(),
		},
	};
	const client = createExtensionPanelClient(
		api as unknown as Parameters<typeof createExtensionPanelClient>[0],
	);
	return { api, client };
}

describe("extension panel client without native sidePanel", () => {
	it("loads bookmarks, forwards edits, and reports worker failures", async () => {
		const { api, client } = setup();
		expect((await client.bookmarks.read()).has("owner/repo")).toBe(true);
		const command = { type: "delete-repository", slug: "owner/repo" } as const;
		await client.bookmarks.execute(command);
		expect(api.runtime.sendMessage).toHaveBeenLastCalledWith(command);
		api.runtime.sendMessage.mockResolvedValueOnce({ ok: false });
		await expect(client.bookmarks.execute(command)).rejects.toThrow(
			"The extension did not respond.",
		);
	});
	it("delivers bookmark changes and removes subscriptions", () => {
		const { api, client } = setup();
		const listener = vi.fn();
		const unsubscribe = client.bookmarks.subscribe(listener);
		const changes = {
			[REPOSITORIES_STORAGE_KEY]: {
				newValue: {
					version: 1,
					repositories: [{ slug: "owner/new", sessions: [] }],
				},
			},
		};
		api.storage.onChanged.emit(changes, "session");
		expect(listener).not.toHaveBeenCalled();
		api.storage.onChanged.emit(changes, "local");
		expect(listener).toHaveBeenCalledWith(new Map([["owner/new", new Map()]]));
		unsubscribe();
		api.storage.onChanged.emit(changes, "local");
		expect(listener).toHaveBeenCalledTimes(1);
	});
	it("observes navigation and opens DeepWiki in the appropriate tab", async () => {
		const { api, client } = setup();
		expect(await client.navigation.readUrl()).toBe(
			"https://deepwiki.com/owner/repo",
		);
		const listener = vi.fn();
		const unsubscribe = client.navigation.subscribe(listener);
		api.tabs.onActivated.emit();
		api.tabs.onUpdated.emit();
		unsubscribe();
		api.tabs.onActivated.emit();
		api.tabs.onUpdated.emit();
		expect(listener).toHaveBeenCalledTimes(2);
		const url = "https://deepwiki.com/search/one";
		await openDeepWiki(client, url);
		expect(api.tabs.update).toHaveBeenCalledWith(1, { url });
		api.tabs.query.mockResolvedValueOnce([
			{ id: 3, windowId: 2, url: "https://example.com" },
		]);
		await openDeepWiki(client, url);
		expect(api.tabs.create).toHaveBeenCalledWith({ url, windowId: 2 });
		await expect(openDeepWiki(client, "https://example.com")).rejects.toThrow(
			"Only DeepWiki URLs",
		);
		expect(api.tabs.create).toHaveBeenCalledTimes(1);
		expect(api.tabs.update).toHaveBeenCalledTimes(1);
	});
});
