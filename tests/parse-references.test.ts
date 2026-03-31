import { describe, it, expect } from "vitest";
import { parseReferences } from "../src/parse-references";

describe("parseReferences — relativePaths", () => {
	it("extracts backtick-quoted paths", () => {
		const text = "Read `references/SCHEMA.md` and `scripts/run.sh` for details.";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("references/SCHEMA.md");
		expect(relativePaths).toContain("scripts/run.sh");
	});

	it("extracts markdown link targets", () => {
		const text = "See [FORMS.md](references/forms.md) for the guide.";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("references/forms.md");
	});

	it("extracts {baseDir} paths and strips prefix", () => {
		const text = "Run: `{baseDir}/scripts/run.sh`";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("scripts/run.sh");
	});

	it("extracts {baseDir} in markdown link and strips prefix", () => {
		const text = "Run the script: [run]({baseDir}/scripts/run.sh)";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("scripts/run.sh");
		expect(relativePaths).not.toContain("{baseDir}/scripts/run.sh");
	});

	it("extracts paths after common CLI commands", () => {
		const text = [
			"python3 scripts/fetch.py --flag",
			"bash scripts/run.sh query",
			"node scripts/typefully.js create",
		].join("\n");
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("scripts/fetch.py");
		expect(relativePaths).toContain("scripts/run.sh");
		expect(relativePaths).toContain("scripts/typefully.js");
	});

	it("deduplicates paths", () => {
		const text = [
			"Read `scripts/run.sh` first.",
			"Then run: bash scripts/run.sh",
		].join("\n");
		const { relativePaths } = parseReferences(text);
		const count = relativePaths.filter((r) => r === "scripts/run.sh").length;
		expect(count).toBe(1);
	});

	it("returns empty arrays for text with no references", () => {
		const text = "This skill does something cool.";
		const { relativePaths, absolutePaths } = parseReferences(text);
		expect(relativePaths).toEqual([]);
		expect(absolutePaths).toEqual([]);
	});

	it("ignores URLs", () => {
		const text = "See https://example.com/path/to/file.md for details.";
		const { relativePaths, absolutePaths } = parseReferences(text);
		expect(relativePaths).toHaveLength(0);
		expect(absolutePaths).toHaveLength(0);
	});

	it("collects ~ paths as relative paths (for unresolved display)", () => {
		const text = "Uses `~/workspace/scout/threads/threads.db` for data.";
		const { relativePaths, absolutePaths } = parseReferences(text);
		expect(relativePaths).toContain("~/workspace/scout/threads/threads.db");
		expect(absolutePaths).toHaveLength(0);
	});

	it("collects .openclaw/skills/ paths via ~ prefix", () => {
		const text = "Uses `~/.openclaw/skills/check-traces/SKILL.md` for tracing.";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain("~/.openclaw/skills/check-traces/SKILL.md");
	});

	it("collects .openclaw/skills/ path without ~ prefix", () => {
		const text = "Uses `.openclaw/skills/foo/SKILL.md` for something.";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toContain(".openclaw/skills/foo/SKILL.md");
	});
});

describe("parseReferences — absolutePaths", () => {
	it("collects absolute paths separately", () => {
		const text = "python3 /home/user/workspace/skills/my-skill/scripts/fetch.py";
		const { relativePaths, absolutePaths } = parseReferences(text);
		expect(relativePaths).toHaveLength(0);
		expect(absolutePaths).toContain("/home/user/workspace/skills/my-skill/scripts/fetch.py");
	});

	it("collects backtick absolute paths", () => {
		const text = "Read `/home/user/workspace/skills/x-reply/references/subagent-prompt.md`";
		const { absolutePaths } = parseReferences(text);
		expect(absolutePaths).toContain("/home/user/workspace/skills/x-reply/references/subagent-prompt.md");
	});

	it("does not put absolute paths in relativePaths", () => {
		const text = "`/home/user/workspace/skills/foo/scripts/bar.py`";
		const { relativePaths } = parseReferences(text);
		expect(relativePaths).toHaveLength(0);
	});
});
