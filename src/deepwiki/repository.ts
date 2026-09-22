export type RepositorySlug = string;
export type SessionUrl = string;

export type Session = {
	url: SessionUrl;
	createdAt: number;
	alias?: string;
};

export type RepositoryStore = Map<RepositorySlug, Map<SessionUrl, Session>>;

export function upsertRepository(
	repositoryStore: RepositoryStore,
	slug: RepositorySlug,
): RepositoryStore {
	if (repositoryStore.has(slug)) {
		return repositoryStore;
	}

	const nextStore = new Map(repositoryStore);
	nextStore.set(slug, new Map());
	return nextStore;
}

function findSession(
	repositoryStore: RepositoryStore,
	sessionUrl: SessionUrl,
): Session | null {
	for (const sessions of repositoryStore.values()) {
		const session = sessions.get(sessionUrl);
		if (session) {
			return session;
		}
	}

	return null;
}

export function appendSession(
	repositoryStore: RepositoryStore,
	slug: RepositorySlug,
	sessionUrl: SessionUrl,
): RepositoryStore {
	const currentOwner = findSessionOwner(repositoryStore, sessionUrl);
	if (currentOwner === slug) {
		return repositoryStore;
	}

	const existingSession = findSession(repositoryStore, sessionUrl);
	const createdAt = existingSession?.createdAt ?? Date.now();
	const alias = existingSession?.alias;
	const nextStore = new Map(repositoryStore);

	if (currentOwner) {
		const currentOwnerSessions = new Map(nextStore.get(currentOwner));
		currentOwnerSessions.delete(sessionUrl);
		nextStore.set(currentOwner, currentOwnerSessions);
	}

	const targetSessions = new Map(nextStore.get(slug) ?? []);
	targetSessions.set(sessionUrl, {
		url: sessionUrl,
		createdAt,
		...(alias ? { alias } : {}),
	});
	nextStore.set(slug, targetSessions);

	return nextStore;
}

export function setSessionAlias(
	repositoryStore: RepositoryStore,
	sessionUrl: SessionUrl,
	alias: string,
): RepositoryStore {
	const owner = findSessionOwner(repositoryStore, sessionUrl);
	if (!owner) {
		return repositoryStore;
	}

	const sessions = repositoryStore.get(owner);
	const session = sessions?.get(sessionUrl);
	if (!sessions || !session) {
		return repositoryStore;
	}

	const normalizedAlias = alias.trim();
	const nextAlias = normalizedAlias.length > 0 ? normalizedAlias : undefined;
	if (session.alias === nextAlias) {
		return repositoryStore;
	}

	const nextSessions = new Map(sessions);
	nextSessions.set(sessionUrl, {
		url: session.url,
		createdAt: session.createdAt,
		...(nextAlias ? { alias: nextAlias } : {}),
	});

	const nextStore = new Map(repositoryStore);
	nextStore.set(owner, nextSessions);
	return nextStore;
}

export function findSessionOwner(
	repositoryStore: RepositoryStore,
	sessionUrl: SessionUrl,
): RepositorySlug | null {
	for (const [slug, sessions] of repositoryStore.entries()) {
		if (sessions.has(sessionUrl)) {
			return slug;
		}
	}

	return null;
}
