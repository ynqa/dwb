import { describe, expect, it } from "vitest";
import {
	appendSession,
	type RepositoryStore,
	setSessionAlias,
} from "@/deepwiki/repository";

describe("setSessionAlias", () => {
	it("stores a trimmed alias for an existing session", () => {
		const sessionUrl = "https://deepwiki.com/search/abc?q=test";
		const store: RepositoryStore = new Map([
			[
				"owner/repo",
				new Map([[sessionUrl, { url: sessionUrl, createdAt: 1 }]]),
			],
		]);

		const next = setSessionAlias(store, sessionUrl, "  my alias  ");

		expect(next).not.toBe(store);
		expect(next.get("owner/repo")?.get(sessionUrl)?.alias).toBe("my alias");
	});

	it("clears alias when blank text is given", () => {
		const sessionUrl = "https://deepwiki.com/search/abc?q=test";
		const store: RepositoryStore = new Map([
			[
				"owner/repo",
				new Map([
					[sessionUrl, { url: sessionUrl, createdAt: 1, alias: "alias" }],
				]),
			],
		]);

		const next = setSessionAlias(store, sessionUrl, "   ");

		expect(next.get("owner/repo")?.get(sessionUrl)?.alias).toBeUndefined();
	});
});

describe("appendSession", () => {
	it("keeps alias when moving a session between repositories", () => {
		const sessionUrl = "https://deepwiki.com/search/abc?q=test";
		const store: RepositoryStore = new Map([
			[
				"owner/repo-a",
				new Map([
					[
						sessionUrl,
						{ url: sessionUrl, createdAt: 10, alias: "saved alias" },
					],
				]),
			],
			["owner/repo-b", new Map()],
		]);

		const next = appendSession(store, "owner/repo-b", sessionUrl);

		expect(next.get("owner/repo-a")?.has(sessionUrl)).toBe(false);
		expect(next.get("owner/repo-b")?.get(sessionUrl)).toEqual({
			url: sessionUrl,
			createdAt: 10,
			alias: "saved alias",
		});
	});
});
