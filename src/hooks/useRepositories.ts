import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import { sendCommand, type RepositoryCommand } from "@/extension/messages";
import type { RepositoryStore } from "@/lib/repository";
import {
	parsePersistedRepositories,
	REPOSITORIES_STORAGE_KEY,
} from "@/lib/repositoryPersistence";

export function useRepositories() {
	const [repositoryStore, setRepositoryStore] = useState<RepositoryStore>(
		new Map(),
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (!globalThis.chrome?.runtime?.id) {
			setError(
				"Load the built extension in Chrome to save your DeepWiki browsing history.",
			);
			setLoading(false);
			return;
		}
		let cancelled = false;
		let revision = 0;
		const onChanged = (
			changes: Record<string, chrome.storage.StorageChange>,
			area: string,
		) => {
			if (area === "local" && changes[REPOSITORIES_STORAGE_KEY]) {
				revision++;
				setRepositoryStore(
					parsePersistedRepositories(
						changes[REPOSITORIES_STORAGE_KEY].newValue,
					),
				);
			}
		};
		chrome.storage.onChanged.addListener(onChanged);
		const initialRevision = revision;
		void sendCommand({ type: "initialize" })
			.then(() => chrome.storage.local.get(REPOSITORIES_STORAGE_KEY))
			.then((data) => {
				if (!cancelled && revision === initialRevision)
					setRepositoryStore(
						parsePersistedRepositories(data[REPOSITORIES_STORAGE_KEY]),
					);
			})
			.catch((error: unknown) => {
				if (!cancelled) setError(`Failed to load bookmarks: ${String(error)}`);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
			chrome.storage.onChanged.removeListener(onChanged);
		};
	}, []);
	const mutate = (command: RepositoryCommand) => {
		void sendCommand(command).catch((error: unknown) => {
			notifications.show({
				title: "Could not save changes",
				message: String(error),
				color: "red",
			});
		});
	};
	return { repositoryStore, mutate, loading, error };
}
