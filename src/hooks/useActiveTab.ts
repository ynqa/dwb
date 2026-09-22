import { useEffect, useState } from "react";
import { normalizeUrl } from "@/deepwiki/deepWikiUrl";
import type { PanelClient } from "@/panel/PanelClient";

export function useActiveTab(client: PanelClient) {
	const [url, setUrl] = useState("");
	useEffect(() => {
		let cancelled = false;
		let revision = 0;
		const refresh = () => {
			const current = ++revision;
			void client.navigation
				.readUrl()
				.then((url) => {
					if (!cancelled && current === revision) setUrl(normalizeUrl(url));
				})
				.catch(() => {
					if (!cancelled && current === revision) setUrl("");
				});
		};
		const unsubscribe = client.navigation.subscribe(refresh);
		refresh();
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, [client]);
	return [url, setUrl] as const;
}
