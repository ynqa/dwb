import { createDeepWikiPanelClient } from "@/deepwiki/panelClient";
import { mountPanel } from "@/main";
import { previewClient } from "@/panel/previewClient";
import { createBrowserPlatform } from "./browserPlatform";

const client = globalThis.chrome?.runtime?.id
	? createDeepWikiPanelClient(createBrowserPlatform(chrome))
	: previewClient;

mountPanel(client);
