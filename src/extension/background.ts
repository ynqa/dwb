import { startBookmarkService } from "@/deepwiki/bookmarkService";
import { createBrowserPlatform } from "./browserPlatform";
import { registerNativeSidePanel } from "./nativeSidePanel";

startBookmarkService(createBrowserPlatform(chrome));
registerNativeSidePanel(chrome);
