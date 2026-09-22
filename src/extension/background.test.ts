import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPOSITORIES_STORAGE_KEY } from "@/deepwiki/repositoryPersistence";

function event() {
	const listeners: Array<(...args: any[]) => any> = [];
	return {
		addListener: (listener: (...args: any[]) => any) =>
			listeners.push(listener),
		emit: (...args: any[]) => listeners.map((listener) => listener(...args)),
	};
}
function storage() {
	const values: Record<string, unknown> = {};
	return {
		values,
		get: vi.fn(async (key: string | null) =>
			structuredClone(key === null ? values : { [key]: values[key] }),
		),
		set: vi.fn(async (data: Record<string, unknown>) => {
			Object.assign(values, structuredClone(data));
		}),
		remove: vi.fn(async (keys: string | string[]) => {
			for (const key of [keys].flat()) delete values[key];
		}),
	};
}
let api: ReturnType<typeof mockChrome>;
function mockChrome(local = storage(), session = storage()) {
	return {
		storage: { local, session },
		runtime: {
			id: "dwb-test",
			getURL: (path: string) => `chrome-extension://dwb-test/${path}`,
			onInstalled: event(),
			onStartup: event(),
			onMessage: event(),
		},
		sidePanel: { setPanelBehavior: vi.fn(async () => {}) },
		tabs: {
			onRemoved: event(),
			query: vi.fn(async (): Promise<chrome.tabs.Tab[]> => []),
		},
		webNavigation: {
			onCommitted: event(),
			onHistoryStateUpdated: event(),
			onCreatedNavigationTarget: event(),
		},
	};
}
async function boot(
	local?: ReturnType<typeof storage>,
	session?: ReturnType<typeof storage>,
	configure?: (api: ReturnType<typeof mockChrome>) => void,
) {
	vi.resetModules();
	api = mockChrome(local, session);
	configure?.(api);
	vi.stubGlobal("chrome", api);
	await import("./background");
}
function command(message: unknown): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		api.runtime.onMessage.emit(
			message,
			{
				id: api.runtime.id,
				url: `chrome-extension://${api.runtime.id}/index.html`,
			},
			resolve,
		);
	});
}
async function flush() {
	expect(await command({ type: "initialize" })).toEqual({ ok: true });
}
function navigate(tabId: number, path: string, spa = false, frameId = 0) {
	const url = path.startsWith("https://")
		? path
		: `https://deepwiki.com${path}`;
	api.webNavigation[spa ? "onHistoryStateUpdated" : "onCommitted"].emit({
		tabId,
		frameId,
		url,
	});
}
function saved() {
	return (
		(
			api.storage.local.values[REPOSITORIES_STORAGE_KEY] as
				| {
						repositories: Array<{
							slug: string;
							sessions: Array<{ url: string; alias?: string }>;
						}>;
				  }
				| undefined
		)?.repositories ?? []
	);
}
beforeEach(async () => {
	await boot();
});

describe("extension background", () => {
	it.each([
		"missing",
		"rejected",
		"pending",
	])("tracks existing tabs and accepts edits when native sidePanel is %s", async (failure) => {
		const logging = vi.spyOn(console, "warn").mockImplementation(() => {});
		try {
			await boot(undefined, undefined, (browser) => {
				if (failure === "missing") Reflect.deleteProperty(browser, "sidePanel");
				else if (failure === "rejected")
					browser.sidePanel.setPanelBehavior.mockRejectedValue(
						new Error("Unsupported"),
					);
				else
					browser.sidePanel.setPanelBehavior.mockImplementation(
						() => new Promise<void>(() => {}),
					);
				browser.tabs.query.mockResolvedValue([
					{ id: 1, url: "https://deepwiki.com/owner/repo" } as chrome.tabs.Tab,
				]);
			});
			api.runtime.onStartup.emit();
			await flush();
			expect(saved().map((repo) => repo.slug)).toEqual(["owner/repo"]);
			navigate(1, "/search/one", true);
			await command({
				type: "rename-session",
				url: "https://deepwiki.com/search/one",
				alias: "Notes",
			});
			expect(saved()[0].sessions[0].alias).toBe("Notes");
		} finally {
			logging.mockRestore();
		}
	});
	it("configures native presentation independently of bookmark reads", async () => {
		expect(api.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
			openPanelOnActionClick: true,
		});
		api.sidePanel.setPanelBehavior.mockClear();
		await flush();
		expect(api.sidePanel.setPanelBehavior).not.toHaveBeenCalled();
		api.runtime.onInstalled.emit();
		await flush();
		expect(api.sidePanel.setPanelBehavior).toHaveBeenCalledTimes(1);
	});
	it("records SPA sessions with the panel closed and isolates simultaneous tabs", async () => {
		navigate(1, "/owner/a");
		navigate(2, "/owner/b");
		navigate(1, "/search/first", true);
		navigate(2, "/search/second", true);
		await flush();
		expect(saved()).toEqual([
			{
				slug: "owner/a",
				sessions: [
					expect.objectContaining({ url: "https://deepwiki.com/search/first" }),
				],
			},
			{
				slug: "owner/b",
				sessions: [
					expect.objectContaining({
						url: "https://deepwiki.com/search/second",
					}),
				],
			},
		]);
	});
	it("restores per-tab context after the worker stops", async () => {
		navigate(7, "/owner/repo");
		await flush();
		await boot(api.storage.local, api.storage.session);
		navigate(7, "/search/resumed", true);
		await flush();
		expect(saved()[0].sessions[0].url).toBe(
			"https://deepwiki.com/search/resumed",
		);
	});
	it("ignores subframes and sessions with no known repository", async () => {
		navigate(1, "/owner/iframe", false, 1);
		navigate(1, "/search/unknown", true);
		await flush();
		expect(saved()).toEqual([]);
	});
	it("clears context on home, unrelated sites, and tab closure", async () => {
		for (const tabId of [1, 2, 3]) navigate(tabId, "/owner/repo");
		navigate(1, "/");
		navigate(2, "https://example.com");
		api.tabs.onRemoved.emit(3);
		for (const tabId of [1, 2, 3]) navigate(tabId, `/search/unowned-${tabId}`);
		await flush();
		expect(saved()[0].sessions).toEqual([]);
		expect(api.storage.session.values).toEqual({});
	});
	it("inherits the source repository when opening a search in a new tab", async () => {
		navigate(1, "/owner/repo");
		api.webNavigation.onCreatedNavigationTarget.emit({
			sourceTabId: 1,
			sourceFrameId: 0,
			tabId: 2,
			url: "https://deepwiki.com/search/new-tab",
		});
		navigate(2, "/search/new-tab");
		await flush();
		expect(saved()[0].sessions).toHaveLength(1);
	});
	it("preserves edits while more tabs navigate, and deletes without stale writes", async () => {
		navigate(1, "/owner/repo");
		navigate(1, "/search/one", true);
		const rename = command({
			type: "rename-session",
			url: "https://deepwiki.com/search/one",
			alias: "  Notes  ",
		});
		navigate(2, "/owner/other");
		navigate(1, "/search/two", true);
		await rename;
		await flush();
		expect(
			saved().find((repo) => repo.slug === "owner/repo")?.sessions,
		).toContainEqual(expect.objectContaining({ alias: "Notes" }));
		await command({
			type: "delete-session",
			slug: "owner/repo",
			url: "https://deepwiki.com/search/one",
		});
		expect(
			saved().find((repo) => repo.slug === "owner/repo")?.sessions,
		).toHaveLength(1);
		await command({ type: "delete-repository", slug: "owner/repo" });
		navigate(1, "/search/three", true);
		await flush();
		expect(saved().map((repo) => repo.slug)).toEqual(["owner/other"]);
	});
	it("keeps the original owner of an already saved session", async () => {
		navigate(1, "/owner/a");
		navigate(1, "/search/saved", true);
		navigate(1, "/owner/b");
		navigate(1, "/search/saved", true);
		await flush();
		expect(saved()[0].sessions).toHaveLength(1);
		expect(saved()[1].sessions).toHaveLength(0);
		expect(api.storage.session.values["dwb.tab.1"]).toBe("owner/a");
	});
	it("rejects malformed messages and edits from web tabs", () => {
		const reply = vi.fn();
		expect(
			api.runtime.onMessage.emit(
				{ type: "delete-repository" },
				{ id: api.runtime.id },
				reply,
			),
		).toEqual([false]);
		expect(
			api.runtime.onMessage.emit(
				{ type: "delete-repository", slug: "owner/repo" },
				{ id: api.runtime.id, tab: { id: 1 } },
				reply,
			),
		).toEqual([false]);
		expect(reply).not.toHaveBeenCalled();
	});
	it("reports write failures and processes subsequent requests", async () => {
		const logging = vi.spyOn(console, "error").mockImplementation(() => {});
		navigate(1, "/owner/repo");
		navigate(1, "/search/one", true);
		await flush();
		api.storage.local.set.mockRejectedValueOnce(new Error("Storage full"));
		expect(
			await command({ type: "delete-repository", slug: "owner/repo" }),
		).toEqual({ ok: false, error: "Error: Storage full" });
		await command({
			type: "rename-session",
			url: "https://deepwiki.com/search/one",
			alias: "Saved",
		});
		expect(saved()[0].sessions[0].alias).toBe("Saved");
		logging.mockRestore();
	});
});
