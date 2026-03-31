/**
 * Extracts referenced file paths from SKILL.md content.
 * Pure function with no Obsidian API dependencies — fully unit-testable.
 *
 * Returns two path categories:
 * - relativePaths: relative paths (can be resolved directly or via skill-parser)
 * - absolutePaths: absolute paths (skill-parser strips the vault base prefix)
 */
export interface ParseResult {
	relativePaths: string[];
	absolutePaths: string[];
}

export function parseReferences(text: string): ParseResult {
	const relativePaths = new Set<string>();
	const absolutePaths = new Set<string>();

	// Shared helper to classify and collect a candidate path
	const collect = (p: string) => {
		// Ignore URLs
		if (/^https?:\/\//.test(p)) return;

		// Absolute paths: hand off to skill-parser for vault prefix matching
		if (p.startsWith("/")) {
			if (looksLikeFilePath(p)) {
				absolutePaths.add(p);
			}
			return;
		}

		// ~ paths (e.g. ~/workspace/.openclaw/skills/foo/SKILL.md):
		// keep as-is for unresolvedRefs display
		if (p.startsWith("~")) {
			if (looksLikeFilePath(p)) {
				relativePaths.add(p);
			}
			return;
		}

		// Relative paths: strip {baseDir}/ prefix if present
		const cleaned = p.replace(/^\{baseDir\}\//, "");
		if (looksLikeFilePath(cleaned)) {
			relativePaths.add(cleaned);
		}
	};

	// Pattern 1: backtick paths — `references/SCHEMA.md`
	const backtickRegex = /`([^`\n]+)`/g;
	for (const match of text.matchAll(backtickRegex)) {
		collect(match[1]!);
	}

	// Pattern 2: Markdown links — [text](path)
	const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
	for (const match of text.matchAll(mdLinkRegex)) {
		collect(match[2]!);
	}

	// Pattern 3: CLI command paths — python3/bash/node/sh followed by a file path
	const cliRegex = /(?:python3?|bash|node|sh)\s+([\w.{}/.-]+\.\w+)/g;
	for (const match of text.matchAll(cliRegex)) {
		collect(match[1]!);
	}

	return {
		relativePaths: [...relativePaths],
		absolutePaths: [...absolutePaths],
	};
}

/** Returns true if the string looks like a file path (contains a slash and a file extension) */
function looksLikeFilePath(p: string): boolean {
	return p.includes("/") && /\.\w+$/.test(p);
}
