// ESLint flat config (ESLint v9+) for this Obsidian plugin.
//
// Uses the official `eslint-plugin-obsidianmd` recommended ruleset plus the
// type-aware `typescript-eslint` parser so the Obsidian community review
// (which runs this exact plugin) can be reproduced locally via `npm run lint`.
//
// Setup follows the eslint-plugin-obsidianmd README: spread
// `obsidianmd.configs.recommended`, then point the TypeScript parser at
// tsconfig.json for the type-aware rules. Tests, mocks and build artifacts
// are excluded so the type-aware parser only sees the plugin source that
// tsconfig.json's `include` covers.
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{
		ignores: [
			"main.js",
			"esbuild.config.mjs",
			"**/*.test.ts",
			"__mocks__/**",
		],
	},
	...obsidianmd.configs.recommended,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			// The settings tab uses setPlaceholder() to show *example* input
			// values (default hex colors like "#de7356" and the example
			// folder name "skills"). These are illustrative samples, not UI
			// prose, so the sentence-case rule's suggestions (e.g. "#De7356",
			// "Skills") would be wrong — a hex placeholder must stay lower
			// case. Skip strings that are a hex color or a single lowercase
			// token so the rule still applies to real UI text.
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					enforceCamelCaseLower: true,
					ignoreRegex: ["^#[0-9a-fA-F]{3,8}$", "^[a-z][a-z-]*$"],
				},
			],
		},
	},
]);
