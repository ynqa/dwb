import { HOME_ORIGIN, HOME_URL } from "@/deepwiki/constants";

type UrlKind =
	| { type: "home" } // Home page
	| { type: "repository"; slug: string } // Repository page (e.g., /owner/repo)
	| { type: "session" } // Search session page (e.g., /search/...)
	| { type: "other" };

export function normalizeUrl(raw: string): string {
	try {
		const url = new URL(raw);
		if (url.origin !== HOME_ORIGIN) {
			return raw;
		}
		if (url.pathname === "/") {
			return HOME_URL;
		}
		return `${url.origin}${url.pathname}${url.search}`;
	} catch {
		return raw;
	}
}

export function parseDeepWikiUrl(raw: string): UrlKind {
	try {
		const url = new URL(raw);
		if (url.origin !== HOME_ORIGIN) {
			return { type: "other" };
		}

		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length === 0) {
			return { type: "home" };
		}

		if (segments[0] === "search" && segments.length >= 2) {
			return { type: "session" };
		}

		if (segments.length >= 2) {
			return { type: "repository", slug: `${segments[0]}/${segments[1]}` };
		}

		return { type: "other" };
	} catch {
		return { type: "other" };
	}
}

export function formatSessionLabel(url: string): string {
	try {
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return url;
	}
}
