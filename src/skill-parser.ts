import { App, FileSystemAdapter, TFile } from "obsidian";
import { readFileSync } from "fs";
import { homedir } from "os";
import { parseReferences } from "./parse-references";
import type { SkillInfo } from "./types";
// Import types.ts to activate module augmentation (FileSystemAdapter.basePath)
import "./types";

/**
 * Scans all SKILL.md files in the vault and parses skill information.
 * Listens to metadata cache changes for incremental updates.
 */
export class SkillParser {
	private app: App;
	private skillFileName: string;
	private nameField: string;
	/**
	 * Vault-relative folder whose direct .md children are also treated as
	 * skill files (additive to the exact skillFileName match). Empty string
	 * "" disables this folder rule.
	 */
	private skillsFolder: string;
	/** Global skill info map, keyed by vault-relative file path */
	skillMap: Map<string, SkillInfo> = new Map();

	constructor(
		app: App,
		skillFileName: string,
		nameField: string,
		skillsFolder: string
	) {
		this.app = app;
		this.skillFileName = skillFileName;
		this.nameField = nameField;
		this.skillsFolder = this.normalizeSkillsFolder(skillsFolder);
	}

	/** Update settings and re-scan */
	async updateSettings(
		skillFileName: string,
		nameField: string,
		skillsFolder: string
	): Promise<void> {
		this.skillFileName = skillFileName;
		this.nameField = nameField;
		this.skillsFolder = this.normalizeSkillsFolder(skillsFolder);
		await this.fullScan();
	}

	/**
	 * Normalize the raw skillsFolder setting so it can be compared by strict
	 * equality against Obsidian's vault-relative `file.parent?.path`, which
	 * never has surrounding whitespace nor leading/trailing slashes. Trims
	 * whitespace then strips leading/trailing `/`. A whitespace-only or
	 * slash-only input therefore collapses to "" — the documented opt-out
	 * (folder rule disabled) — instead of a dead value that matches nothing.
	 */
	private normalizeSkillsFolder(input: string): string {
		return input.trim().replace(/^\/+|\/+$/g, "");
	}

	/**
	 * Whether a file should be treated as a skill file. Two additive rules,
	 * OR'd together:
	 * 1. Exact filename match (`file.name === skillFileName`) — classic
	 *    per-skill `SKILL.md` vaults. Always active.
	 * 2. The file is a direct .md child of the configured skills folder —
	 *    flat skill-manager-sync vaults (`skills/<atomic-id>.md`). Disabled
	 *    when `skillsFolder` is the empty string.
	 *
	 * Detection is path/name only (vault-relative `file.parent?.path`) — no
	 * fs access, readlink, or symlink resolution.
	 */
	private isSkillFile(file: TFile): boolean {
		return (
			file.name === this.skillFileName ||
			(this.skillsFolder !== "" &&
				file.extension === "md" &&
				file.parent?.path === this.skillsFolder)
		);
	}

	/**
	 * Whether a file is an agent file (frontmatter `type: agent`).
	 * Detection goes through metadataCache only — no text/regex frontmatter
	 * parsing — to avoid two divergent detection paths.
	 */
	private isAgentFile(file: TFile): boolean {
		return (
			this.app.metadataCache.getFileCache(file)?.frontmatter?.type ===
			"agent"
		);
	}

	/** Full scan of all SKILL.md and agent files in the vault */
	async fullScan(): Promise<void> {
		this.skillMap.clear();
		// Scan all files (not just Markdown): skillFileName is user-
		// configurable and may be a non-.md manifest, so matching it across
		// every vault file preserves the original behavior. Agent detection
		// is gated on .md to avoid metadataCache lookups on binary files.
		const files = this.app.vault.getFiles();
		const promises: Promise<void>[] = [];
		for (const file of files) {
			if (
				this.isSkillFile(file) ||
				(file.extension === "md" && this.isAgentFile(file))
			) {
				promises.push(this.parseSkillFile(file));
			}
		}
		await Promise.all(promises);
	}

	/** Parse a single SKILL.md or agent file */
	async parseSkillFile(file: TFile): Promise<void> {
		// Fetch the file cache once and reuse it for both the agent check
		// and display-name resolution (avoids a redundant metadataCache
		// lookup in the hot path — parseSkillFile runs on every metadata
		// change). Agent detection still goes through metadataCache only.
		const cache = this.app.metadataCache.getFileCache(file);
		const isSkill = this.isSkillFile(file);
		const isAgent =
			file.extension === "md" && cache?.frontmatter?.type === "agent";

		// Neither a skill nor an agent file. If we previously tracked this
		// path (e.g. the user removed `type: agent` from a file), remove the
		// now-stale entry so the graph stops coloring it.
		if (!isSkill && !isAgent) {
			if (this.skillMap.has(file.path)) {
				this.skillMap.delete(file.path);
			}
			return;
		}

		const kind: "skill" | "agent" = isAgent ? "agent" : "skill";

		// Classic SKILL.md: identity lives in the parent folder
		// (content-planner/SKILL.md → "content-planner"). Flat folder-rule
		// files: the filename itself is the unique identity
		// (skills/foo-abc123.md); the shared parent ("skills") would collapse
		// every node to one label. The `&& file.parent?.name` guard also
		// covers a SKILL.md at the vault root, where `parent.name` is "" — an
		// empty string is not nullish, so `??` alone would not fall through to
		// the basename. `||` treats "" as falsy and correctly falls back.
		const isExactNameMatch = file.name === this.skillFileName;
		const displayName =
			cache?.frontmatter?.[this.nameField] ??
			((isExactNameMatch && file.parent?.name) || file.basename);

		const references: string[] = [];
		const unresolvedRefs: string[] = [];
		const externalDisplayNames = new Map<string, string>();

		// Only skill files run reference resolution. Agent → skill edges come
		// from Obsidian's native markdown-link resolution (resolvedLinks),
		// not from this plugin's reference injection.
		if (isSkill) {
			// Read file content
			const text = await this.app.vault.cachedRead(file);

			// Parse references from content
			const { relativePaths, absolutePaths } = parseReferences(text);
			const dir = file.parent?.path ?? "";

			// Resolve relative paths
			for (const ref of relativePaths) {
				const resolved = this.resolveRefPath(ref, dir);
				if (resolved) {
					references.push(resolved);
				} else {
					// Skip paths with placeholders (e.g. [market], YYYY-MM)
					if (!/[[\]{}]/.test(ref) && !/YYYY/.test(ref)) {
						unresolvedRefs.push(ref);
					}
				}
			}

			// Resolve absolute paths: strip vault base path prefix to get vault-relative path
			const adapter = this.app.vault.adapter;
			const vaultBasePath = adapter instanceof FileSystemAdapter ? adapter.basePath : undefined;
			if (vaultBasePath) {
				for (const absPath of absolutePaths) {
					const vaultRelative = this.absoluteToVaultPath(absPath, vaultBasePath);
					if (vaultRelative && this.app.vault.getAbstractFileByPath(vaultRelative)) {
						references.push(vaultRelative);
					}
					// Absolute paths that don't match are silently ignored (may be from another machine)
				}
			}

			// Try to read display names from external files' frontmatter
			for (const ref of unresolvedRefs) {
				const extName = this.readExternalFrontmatterName(ref);
				if (extName) {
					externalDisplayNames.set(ref, extName);
				}
			}
		}

		this.skillMap.set(file.path, {
			filePath: file.path,
			displayName,
			kind,
			references,
			unresolvedRefs,
			externalDisplayNames,
		});
	}

	/**
	 * Tries multiple strategies to resolve a reference path to a vault file path.
	 * Strategy order:
	 * 1. Relative to the SKILL.md's parent directory (e.g. scripts/run.sh → content-planner/scripts/run.sh)
	 * 2. Directly from vault root (e.g. content-analysis/SKILL.md)
	 * 3. Strip the first path segment (e.g. skills/content-analysis/SKILL.md → content-analysis/SKILL.md,
	 *    for workspace-relative paths when vault root equals skills/)
	 */
	private resolveRefPath(ref: string, parentDir: string): string | null {
		// Strategy 1: relative to SKILL.md's parent directory
		const relPath = parentDir ? `${parentDir}/${ref}` : ref;
		if (this.app.vault.getAbstractFileByPath(relPath)) {
			return relPath;
		}

		// Strategy 2: from vault root
		if (this.app.vault.getAbstractFileByPath(ref)) {
			return ref;
		}

		// Strategy 3: strip first path segment
		// Handles workspace-relative paths (e.g. skills/content-analysis/SKILL.md)
		// when vault root is skills/
		const slashIdx = ref.indexOf("/");
		if (slashIdx !== -1) {
			const stripped = ref.substring(slashIdx + 1);
			if (this.app.vault.getAbstractFileByPath(stripped)) {
				return stripped;
			}
		}

		return null;
	}

	/**
	 * Converts an absolute path to a vault-relative path.
	 * Uses exact prefix matching only (no fuzzy matching) to avoid false positives.
	 *
	 * Example — vault = /home/user/workspace/skills:
	 *   /home/user/workspace/skills/my-skill/scripts/fetch.py
	 *   → my-skill/scripts/fetch.py
	 *
	 * Note: Absolute paths from other machines will not match and are silently
	 * ignored. SKILL.md files should use {baseDir}/-relative paths instead.
	 */
	private absoluteToVaultPath(absPath: string, vaultBasePath: string): string | null {
		const prefix = vaultBasePath.endsWith("/") ? vaultBasePath : vaultBasePath + "/";
		if (absPath.startsWith(prefix)) {
			return absPath.substring(prefix.length);
		}
		return null;
	}

	/**
	 * Try to read the frontmatter `name` from an external file on disk.
	 * Expands ~ to the user's home directory. Returns null on failure.
	 */
	private readExternalFrontmatterName(refPath: string): string | null {
		try {
			let absPath = refPath;
			if (absPath.startsWith("~/")) {
				absPath = homedir() + absPath.substring(1);
			}
			const content = readFileSync(absPath, "utf-8");
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (fmMatch) {
				const nameMatch = fmMatch[1]!.match(/^name:\s*(.+)$/m);
				if (nameMatch) {
					return nameMatch[1]!.replace(/^["']|["']$/g, "").trim();
				}
			}
		} catch {
			// File doesn't exist or can't be read — silently skip
		}
		return null;
	}

	/**
	 * Called when the metadata cache reports a file change.
	 * Routes unconditionally through parseSkillFile so it can self-filter
	 * and self-remove stale entries (e.g. `type: agent` was removed).
	 */
	async onMetadataChanged(file: TFile): Promise<void> {
		await this.parseSkillFile(file);
	}

	/** Remove a deleted file's entry from the skill map */
	onFileDeleted(filePath: string): void {
		this.skillMap.delete(filePath);
	}
}
