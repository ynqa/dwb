import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	base: "./",
	resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
	build: {
		rollupOptions: {
			input: { panel: "index.html", background: "src/extension/background.ts" },
			output: { entryFileNames: "[name].js" },
		},
	},
});
