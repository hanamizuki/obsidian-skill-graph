import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The `obsidian` npm package ships type definitions only (no runtime entry);
// the production esbuild bundle marks it external. For unit tests, alias it
// to a lightweight runtime stub so modules importing from "obsidian" load.
export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL("./tests/__mocks__/obsidian.ts", import.meta.url)
			),
		},
	},
});
