import { describe, expect, it } from "vitest";
import type { RepositoryStore } from "@/deepwiki/repository";
import {
	parsePersistedRepositories,
	serializeRepositories,
} from "@/deepwiki/repositoryPersistence";

describe("repository persistence", () => {
	it("preserves repositories, timestamps, and aliases across a storage round trip", () => {
		const url = "https://deepwiki.com/search/saved";
		const store: RepositoryStore = new Map([
			["owner/empty", new Map()],
			["owner/repo", new Map([[url, { url, createdAt: 42, alias: "Notes" }]])],
		]);

		expect(
			parsePersistedRepositories(structuredClone(serializeRepositories(store))),
		).toEqual(store);
	});

	it("skips malformed entries while retaining valid bookmarks", () => {
		const url = "https://deepwiki.com/search/saved";
		const store = parsePersistedRepositories({
			version: 1,
			repositories: [
				null,
				{ slug: "invalid", sessions: null },
				{
					slug: "owner/repo",
					sessions: [
						null,
						{ url },
						{ url, createdAt: Number.NaN },
						{ url, createdAt: 42, alias: " Notes " },
					],
				},
			],
		});

		expect([...store.keys()]).toEqual(["owner/repo"]);
		expect([...store.get("owner/repo")!.values()]).toEqual([
			{ url, createdAt: 42, alias: "Notes" },
		]);
	});

	it("returns an empty store for missing or unsupported storage data", () => {
		for (const value of [
			undefined,
			null,
			{ version: 2, repositories: [{ slug: "owner/repo", sessions: [] }] },
			{ version: 1, repositories: null },
		]) {
			expect(parsePersistedRepositories(value).size).toBe(0);
		}
	});
});
