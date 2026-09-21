import { normalizeUrl, parseDeepWikiUrl } from "@/lib/deepWikiUrl";
import {
	appendSession,
	findSessionOwner,
	type RepositoryStore,
	upsertRepository,
} from "@/lib/repository";

export function trackNavigation(
	store: RepositoryStore,
	context: string | null,
	rawUrl: string,
) {
	const url = normalizeUrl(rawUrl);
	const kind = parseDeepWikiUrl(url);
	if (kind.type === "repository") {
		return { store: upsertRepository(store, kind.slug), context: kind.slug };
	}
	if (kind.type === "session") {
		const owner = findSessionOwner(store, url) ?? context;
		return {
			store: owner ? appendSession(store, owner, url) : store,
			context: owner,
		};
	}
	return { store, context: null };
}
