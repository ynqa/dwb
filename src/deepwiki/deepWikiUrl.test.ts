import { describe, expect, it } from "vitest";
import { HOME_URL } from "@/deepwiki/constants";
import { normalizeUrl } from "@/deepwiki/deepWikiUrl";

describe("normalizeUrl", () => {
	it("normalizes DeepWiki root URL to HOME_URL", () => {
		expect(normalizeUrl("https://deepwiki.com/")).toBe(HOME_URL);
	});

	it("normalizes DeepWiki URL by removing hash", () => {
		expect(normalizeUrl("https://deepwiki.com/owner/repo?x=1#section")).toBe(
			"https://deepwiki.com/owner/repo?x=1",
		);
	});

	it("returns non-DeepWiki URLs unchanged", () => {
		const raw = "https://example.com/path?a=1#b";
		expect(normalizeUrl(raw)).toBe(raw);
	});

	it("returns invalid URL strings unchanged", () => {
		const raw = "not a url";
		expect(normalizeUrl(raw)).toBe(raw);
	});
});
