import { useEffect, useState } from "react";
import { HOME_ORIGIN } from "@/lib/constants";
import { normalizeUrl } from "@/lib/deepWikiUrl";

export function useActiveTab() {
	const [url, setUrl] = useState("");
	useEffect(() => {
		if (!globalThis.chrome?.runtime?.id) return;
		let cancelled = false;
		let revision = 0;
		const refresh = () => {
			const current = ++revision;
			void chrome.tabs
				.query({ active: true, currentWindow: true })
				.then(([tab]) => {
					if (!cancelled && current === revision)
						setUrl(normalizeUrl(tab?.url ?? ""));
				})
				.catch(() => {
					if (!cancelled && current === revision) setUrl("");
				});
		};
		chrome.tabs.onActivated.addListener(refresh);
		chrome.tabs.onUpdated.addListener(refresh);
		refresh();
		return () => {
			cancelled = true;
			chrome.tabs.onActivated.removeListener(refresh);
			chrome.tabs.onUpdated.removeListener(refresh);
		};
	}, []);
	return [url, setUrl] as const;
}

export async function openDeepWiki(url: string) {
	if (new URL(url).origin !== HOME_ORIGIN)
		throw new Error("Only DeepWiki URLs can be opened.");
	if (!globalThis.chrome?.runtime?.id) {
		window.open(url, "_blank", "noopener,noreferrer");
		return;
	}
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (
		tab?.id !== undefined &&
		tab.url &&
		new URL(tab.url).origin === HOME_ORIGIN
	) {
		await chrome.tabs.update(tab.id, { url });
	} else {
		await chrome.tabs.create({
			url,
			...(tab ? { windowId: tab.windowId } : {}),
		});
	}
}
