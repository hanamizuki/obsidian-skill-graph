import { describe, it, expect } from "vitest";
import { parseReferences } from "../src/parse-references";

describe("parseReferences", () => {
	it("extracts backtick-quoted paths", () => {
		const text = "Read `references/SCHEMA.md` and `scripts/run.sh` for details.";
		const result = parseReferences(text);
		expect(result).toContain("references/SCHEMA.md");
		expect(result).toContain("scripts/run.sh");
	});

	it("extracts markdown link targets", () => {
		const text = "See [FORMS.md](references/forms.md) for the guide.";
		const result = parseReferences(text);
		expect(result).toContain("references/forms.md");
	});

	it("extracts {baseDir} paths and strips prefix", () => {
		const text = "Run: `{baseDir}/scripts/run.sh`";
		const result = parseReferences(text);
		expect(result).toContain("scripts/run.sh");
	});

	it("extracts paths after common CLI commands", () => {
		const text = [
			"python3 scripts/fetch.py --flag",
			"bash scripts/run.sh query",
			"node scripts/typefully.js create",
		].join("\n");
		const result = parseReferences(text);
		expect(result).toContain("scripts/fetch.py");
		expect(result).toContain("scripts/run.sh");
		expect(result).toContain("scripts/typefully.js");
	});

	it("ignores absolute paths", () => {
		const text = "Located at `/Users/harb/OpenClaw/mojo/skills/foo/SKILL.md`";
		const result = parseReferences(text);
		expect(result).not.toContain("/Users/harb/OpenClaw/mojo/skills/foo/SKILL.md");
	});

	it("ignores URLs", () => {
		const text = "See https://example.com/path/to/file.md for details.";
		const result = parseReferences(text);
		expect(result).not.toContain("https://example.com/path/to/file.md");
	});

	it("deduplicates paths", () => {
		const text = [
			"Read `scripts/run.sh` first.",
			"Then run: bash scripts/run.sh",
		].join("\n");
		const result = parseReferences(text);
		const runShCount = result.filter((r) => r === "scripts/run.sh").length;
		expect(runShCount).toBe(1);
	});

	it("returns empty array for text with no references", () => {
		const text = "This skill does something cool.";
		const result = parseReferences(text);
		expect(result).toEqual([]);
	});

	it("ignores .openclaw/skills/ paths (handled separately)", () => {
		const text = "Uses `~/.openclaw/skills/check-traces/SKILL.md` for tracing.";
		const result = parseReferences(text);
		expect(result).not.toContain("~/.openclaw/skills/check-traces/SKILL.md");
	});

	it("extracts {baseDir} in markdown link and strips prefix", () => {
		const text = "Run the script: [run]({baseDir}/scripts/run.sh)";
		const result = parseReferences(text);
		expect(result).toContain("scripts/run.sh");
		expect(result).not.toContain("{baseDir}/scripts/run.sh");
	});

	it("ignores .openclaw/skills/ path without ~ prefix", () => {
		const text = "Uses `.openclaw/skills/foo/SKILL.md` for something.";
		const result = parseReferences(text);
		expect(result).not.toContain(".openclaw/skills/foo/SKILL.md");
	});
});
