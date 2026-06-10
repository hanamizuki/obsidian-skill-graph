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
function makeFakeFile(
	overrides: Partial<{
		path: string;
		name: string;
		extension: string;
		parent: { path: string; name: string };
		basename: string;
	}> = {}
) {
	return {
		path: "agents/foo.md",
		name: "foo.md",
		extension: "md",
		parent: { path: "agents", name: "agents" },
		basename: "foo",
		...overrides,
	};
}

describe("SkillParser — agent stale-node removal", () => {
	it("tracks an agent file, then removes it when type: agent is dropped", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { type: "agent", name: "Foo Agent" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
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

describe("SkillParser — skills folder detection", () => {
	it("treats a direct .md child of skillsFolder as a skill node", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "Foo" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "skills/foo-abc123.md",
			name: "foo-abc123.md",
			extension: "md",
			parent: { path: "skills", name: "skills" },
			basename: "foo-abc123",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("skills/foo-abc123.md")).toBe(true);
		expect(parser.skillMap.get("skills/foo-abc123.md")?.kind).toBe("skill");
	});

	it("does NOT treat the folder child as a skill when skillsFolder is empty", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "Foo" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		// Empty skillsFolder disables the folder rule; name !== "SKILL.md".
		const parser = new SkillParser(app, "SKILL.md", "name", "");
		const file = makeFakeFile({
			path: "skills/foo-abc123.md",
			name: "foo-abc123.md",
			extension: "md",
			parent: { path: "skills", name: "skills" },
			basename: "foo-abc123",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("skills/foo-abc123.md")).toBe(false);
	});

	it("normalizes skillsFolder (trims whitespace, strips slashes) before matching", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "Foo" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		// Raw setting "/skills/" with surrounding space should still match a
		// file whose parent path is the normalized "skills".
		const parser = new SkillParser(app, "SKILL.md", "name", "  /skills/ ");
		const file = makeFakeFile({
			path: "skills/foo-abc123.md",
			name: "foo-abc123.md",
			extension: "md",
			parent: { path: "skills", name: "skills" },
			basename: "foo-abc123",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("skills/foo-abc123.md")).toBe(true);
		expect(parser.skillMap.get("skills/foo-abc123.md")?.kind).toBe("skill");
	});

	it("treats a whitespace-only skillsFolder as disabled (collapses to empty)", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "Foo" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		// "   " normalizes to "" → folder rule disabled; name !== "SKILL.md".
		const parser = new SkillParser(app, "SKILL.md", "name", "   ");
		const file = makeFakeFile({
			path: "skills/foo-abc123.md",
			name: "foo-abc123.md",
			extension: "md",
			parent: { path: "skills", name: "skills" },
			basename: "foo-abc123",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("skills/foo-abc123.md")).toBe(false);
	});

	it("falls back to filename basename for a flat folder-rule file missing nameField", async () => {
		// Regression guard for the PR #3 fallback bug: a flat skill file
		// (skills/foo-abc123.md) whose frontmatter lacks the configured
		// nameField must NOT collapse to the shared parent folder name
		// ("skills") — its identity is the filename basename.
		const fm: { value: Record<string, unknown> | null } = {
			value: { description: "no name field here" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "skills/foo-abc123.md",
			name: "foo-abc123.md",
			extension: "md",
			parent: { path: "skills", name: "skills" },
			basename: "foo-abc123",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("skills/foo-abc123.md")).toBe(true);
		expect(parser.skillMap.get("skills/foo-abc123.md")?.displayName).toBe(
			"foo-abc123"
		);
	});

	it("falls back to parent folder name for a classic SKILL.md missing nameField", async () => {
		// Behavior unchanged for the classic case: SKILL.md identity lives in
		// the parent folder, so a content-planner/SKILL.md missing the name
		// field still resolves to "content-planner".
		const fm: { value: Record<string, unknown> | null } = {
			value: { description: "no name field here" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "content-planner/SKILL.md",
			name: "SKILL.md",
			extension: "md",
			parent: { path: "content-planner", name: "content-planner" },
			basename: "SKILL",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("content-planner/SKILL.md")).toBe(true);
		expect(
			parser.skillMap.get("content-planner/SKILL.md")?.displayName
		).toBe("content-planner");
	});

	it("falls back to basename for a vault-root SKILL.md missing nameField (empty parent name)", async () => {
		// A SKILL.md at the vault root has an empty-string parent.name. An
		// empty string is not nullish, so a plain `??` chain would resolve
		// displayName to "" — the `|| file.basename` form treats "" as falsy
		// and correctly falls back.
		const fm: { value: Record<string, unknown> | null } = {
			value: { description: "no name field here" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "SKILL.md",
			name: "SKILL.md",
			extension: "md",
			parent: { path: "", name: "" },
			basename: "SKILL",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("SKILL.md")).toBe(true);
		expect(parser.skillMap.get("SKILL.md")?.displayName).toBe("SKILL");
	});

	it("still detects classic per-skill SKILL.md regardless of skillsFolder", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "Content Planner" },
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const app = makeFakeApp(fm) as any;
		// skillsFolder set, but the classic name match still wins.
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "content-planner/SKILL.md",
			name: "SKILL.md",
			extension: "md",
			parent: { path: "content-planner", name: "content-planner" },
			basename: "SKILL",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		expect(parser.skillMap.has("content-planner/SKILL.md")).toBe(true);
		expect(parser.skillMap.get("content-planner/SKILL.md")?.kind).toBe(
			"skill"
		);
	});
});

describe("SkillParser — reference resolution", () => {
	it("normalizes parent-relative references before resolving vault paths", async () => {
		const fm: { value: Record<string, unknown> | null } = {
			value: { name: "transcript-summary" },
		};
		const targetPath = "skills/review-card/SKILL.md";
		const existingPaths = new Set([targetPath]);
		const app = {
			metadataCache: {
				getFileCache: () => ({ frontmatter: fm.value }),
			},
			vault: {
				cachedRead: async () => "[review-card](../review-card/SKILL.md)",
				adapter: {},
				getAbstractFileByPath: (path: string) =>
					existingPaths.has(path) ? { path } : null,
				getMarkdownFiles: () => [],
			},
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any;
		const parser = new SkillParser(app, "SKILL.md", "name", "skills");
		const file = makeFakeFile({
			path: "skills/transcript-summary/SKILL.md",
			name: "SKILL.md",
			extension: "md",
			parent: { path: "skills/transcript-summary", name: "transcript-summary" },
			basename: "SKILL",
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		}) as any;

		await parser.parseSkillFile(file);
		const parsed = parser.skillMap.get("skills/transcript-summary/SKILL.md");
		expect(parsed?.references).toContain(targetPath);
		expect(parsed?.unresolvedRefs).not.toContain("../review-card/SKILL.md");
	});
});
