import { useEffect, useState } from "react";
import { HOME_ORIGIN } from "@/lib/constants";
import { normalizeUrl } from "@/lib/deepWikiUrl";
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

export async function openDeepWiki(client: PanelClient, url: string) {
	if (new URL(url).origin !== HOME_ORIGIN)
		throw new Error("Only DeepWiki URLs can be opened.");
	await client.navigation.openUrl(url, HOME_ORIGIN);
}
