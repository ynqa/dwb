import { useEffect, useState } from "react";
import { notifications } from "@mantine/notifications";
import type { RepositoryCommand } from "@/lib/repositoryCommand";
import type { RepositoryStore } from "@/lib/repository";
import type { PanelClient } from "@/panel/PanelClient";

export function useRepositories(client: PanelClient) {
	const [repositoryStore, setRepositoryStore] = useState<RepositoryStore>(
		new Map(),
	);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		setLoading(true);
		setError(null);
		let cancelled = false;
		let revision = 0;
		const unsubscribe = client.bookmarks.subscribe((store) => {
			if (cancelled) return;
			revision++;
			setRepositoryStore(store);
		});
		const initialRevision = revision;
		void client.bookmarks
			.read()
			.then((store) => {
				if (!cancelled && revision === initialRevision)
					setRepositoryStore(store);
			})
			.catch((error: unknown) => {
				if (!cancelled) setError(`Failed to load bookmarks: ${String(error)}`);
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [client]);
	const mutate = (command: RepositoryCommand) => {
		void client.bookmarks.execute(command).catch((error: unknown) => {
			notifications.show({
				title: "Could not save changes",
				message: String(error),
				color: "red",
			});
		});
	};
	return { repositoryStore, mutate, loading, error };
}
