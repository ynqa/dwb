// Browser presentation only: no DeepWiki, bookmark, or UI dependencies.
export function registerNativeSidePanel(
	api: Pick<typeof chrome, "runtime"> & {
		sidePanel?: Pick<typeof chrome.sidePanel, "setPanelBehavior">;
	},
) {
	const configure = async () => {
		try {
			await api.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
		} catch (error) {
			// Presentation failures must not block tracking or loading bookmarks.
			console.warn("dwb: Could not configure the native side panel:", error);
		}
	};
	api.runtime.onInstalled.addListener(configure);
	api.runtime.onStartup.addListener(configure);
	void configure();
}
