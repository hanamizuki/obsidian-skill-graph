import { describe, it, expect } from "vitest";
// `obsidian` is a types-only package (no runtime entry); vitest.config.ts
// aliases it to tests/__mocks__/obsidian.ts so this import chain resolves.
import { SkillParser } from "../src/skill-parser";

/** Mutable fake metadata cache so we can change frontmatter between calls. */
function makeFakeApp(frontmatterRef: { value: Record<string, unknown> | null }) {
	return {
		metadataCache: {
			getFileCache: () => ({ frontmatter: frontmatterRef.value }),
		},
		vault: {
			cachedRead: async () => "",
			adapter: {},
			getAbstractFileByPath: () => null,
			getMarkdownFiles: () => [],
		},
	};
}

/** Minimal fake TFile with the fields parseSkillFile reads. */
function makeFakeFile() {
	return {
		path: "agents/foo.md",
		name: "foo.md",
		extension: "md",
		parent: { path: "agents", name: "agents" },
		basename: "foo",
	};
}

describe("SkillParser — agent stale-node removal", () => {
	it("tracks an agent file, then removes it when type: agent is dropped", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { type: "agent", name: "Foo Agent" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const file = makeFakeFile() as any;

		// First parse: file is an agent file → tracked with kind "agent".
		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("agents/foo.md")).toBe(true);
		expect(parser.skillMap.get("agents/foo.md")?.kind).toBe("agent");
		expect(parser.skillMap.get("agents/foo.md")?.displayName).toBe(
			"Foo Agent"
		);

		// User removes `type: agent`. Re-parsing must drop the stale entry.
		fm.value = { name: "Foo Agent" };
		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("agents/foo.md")).toBe(false);
	});
});
