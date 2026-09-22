import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import manifest from "./src/extension/manifest.json";

export default defineConfig({
	plugins: [
		react(),
		{
			name: "extension-manifest",
			generateBundle() {
				this.emitFile({
					type: "asset",
					fileName: "manifest.json",
					source: JSON.stringify(manifest, null, 2) + "\n",
				});
			},
		},
	],
	base: "./",
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	build: {
		rollupOptions: {
			input: { panel: "index.html", background: "src/extension/background.ts" },
			output: { entryFileNames: "[name].js" },
		},
	},
});
