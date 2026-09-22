import type { PanelClient } from "./PanelClient";

const unavailable = async (): Promise<never> => {
	throw new Error(
		"Load the built extension in a supported browser to save your DeepWiki browsing history.",
	);
};

export const previewClient: PanelClient = {
	bookmarks: {
		read: unavailable,
		subscribe: () => () => {},
		execute: unavailable,
	},
	navigation: {
		readUrl: async () => "",
		subscribe: () => () => {},
		openUrl: async (url) => {
			window.open(url, "_blank", "noopener,noreferrer");
		},
	},
};
