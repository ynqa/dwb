import type {
	RepositorySlug,
	RepositoryStore,
	Session,
	SessionUrl,
} from "@/lib/repository";
import {
	compareRepositorySlug,
	compareSessionCreatedAt,
} from "@/lib/repositorySort";

export const REPOSITORIES_STORAGE_KEY = "dwb.repositories.v1";
const REPOSITORIES_STORAGE_VERSION = 1 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function repositoriesToStore(
	repositories: Array<{ slug: RepositorySlug; sessions: Session[] }>,
): RepositoryStore {
	const store: RepositoryStore = new Map();

	for (const repository of repositories) {
		const sessionsByUrl =
			store.get(repository.slug) ?? new Map<SessionUrl, Session>();

		for (const session of repository.sessions) {
			const existing = sessionsByUrl.get(session.url);
			if (!existing || session.createdAt > existing.createdAt) {
				sessionsByUrl.set(session.url, session);
			}
		}

		store.set(repository.slug, sessionsByUrl);
	}

	return store;
}

function storeToRepositories(
	store: RepositoryStore,
): Array<{ slug: RepositorySlug; sessions: Session[] }> {
	return Array.from(store.entries())
		.map(([slug, sessionsByUrl]) => ({
			slug,
			sessions: Array.from(sessionsByUrl.values()).sort(
				compareSessionCreatedAt,
			),
		}))
		.sort((a, b) => compareRepositorySlug(a.slug, b.slug));
}

function parseSession(value: unknown): Session | null {
	if (!isRecord(value)) {
		return null;
	}

	if (typeof value.url !== "string") {
		return null;
	}

	if (
		typeof value.createdAt !== "number" ||
		!Number.isFinite(value.createdAt)
	) {
		return null;
	}

	const normalizedAlias =
		typeof value.alias === "string" ? value.alias.trim() : undefined;

	return {
		url: value.url,
		createdAt: value.createdAt,
		...(normalizedAlias ? { alias: normalizedAlias } : {}),
	};
}

function parseRepository(
	value: unknown,
): { slug: RepositorySlug; sessions: Session[] } | null {
	if (!isRecord(value)) {
		return null;
	}

	if (typeof value.slug !== "string" || !Array.isArray(value.sessions)) {
		return null;
	}

	const sessions = value.sessions
		.map(parseSession)
		.filter((session): session is Session => session !== null);

	return { slug: value.slug, sessions };
}

function parseRepositoriesArray(value: unknown): RepositoryStore {
	if (!Array.isArray(value)) {
		return new Map();
	}

	const repositories = value
		.map((repository) => parseRepository(repository))
		.filter(
			(
				repository,
			): repository is { slug: RepositorySlug; sessions: Session[] } =>
				repository !== null,
		);

	return repositoriesToStore(repositories);
}

export function parsePersistedRepositories(value: unknown): RepositoryStore {
	if (!isRecord(value)) {
		return new Map();
	}

	if (value.version !== REPOSITORIES_STORAGE_VERSION) {
		return new Map();
	}

	return parseRepositoriesArray(value.repositories);
}

export function deleteRepositoryFromStore(
	repositoryStore: RepositoryStore,
	slug: RepositorySlug,
): RepositoryStore {
	if (!repositoryStore.has(slug)) {
		return repositoryStore;
	}

	const nextStore = new Map(repositoryStore);
	nextStore.delete(slug);
	return nextStore;
}

export function deleteSessionFromStore(
	repositoryStore: RepositoryStore,
	slug: RepositorySlug,
	sessionUrl: SessionUrl,
): RepositoryStore {
	const sessions = repositoryStore.get(slug);
	if (!sessions || !sessions.has(sessionUrl)) {
		return repositoryStore;
	}

	const nextSessions = new Map(sessions);
	nextSessions.delete(sessionUrl);

	const nextStore = new Map(repositoryStore);
	nextStore.set(slug, nextSessions);
	return nextStore;
}

export function serializeRepositories(store: RepositoryStore) {
	return {
		version: REPOSITORIES_STORAGE_VERSION,
		repositories: storeToRepositories(store),
	};
}
