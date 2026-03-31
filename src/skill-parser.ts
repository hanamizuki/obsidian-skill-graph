import { App, TFile } from "obsidian";
import { parseReferences } from "./parse-references";
import type { SkillInfo } from "./types";

/**
 * Scans all SKILL.md files in the vault and parses skill information.
 * Listens to metadata cache changes for incremental updates.
 */
export class SkillParser {
	private app: App;
	private skillFileName: string;
	private nameField: string;
	/** Global skill info map, keyed by vault-relative file path */
	skillMap: Map<string, SkillInfo> = new Map();

	constructor(app: App, skillFileName: string, nameField: string) {
		this.app = app;
		this.skillFileName = skillFileName;
		this.nameField = nameField;
	}

	/** Update settings and re-scan */
	async updateSettings(
		skillFileName: string,
		nameField: string
	): Promise<void> {
		this.skillFileName = skillFileName;
		this.nameField = nameField;
		await this.fullScan();
	}

	/** Full scan of all SKILL.md files in the vault */
	async fullScan(): Promise<void> {
		this.skillMap.clear();
		const files = this.app.vault.getFiles();
		const promises: Promise<void>[] = [];
		for (const file of files) {
			if (file.name === this.skillFileName) {
				promises.push(this.parseSkillFile(file));
			}
		}
		await Promise.all(promises);
	}

	/** Parse a single SKILL.md file */
	async parseSkillFile(file: TFile): Promise<void> {
		if (file.name !== this.skillFileName) return;

		// Read display name from frontmatter
		const cache = this.app.metadataCache.getFileCache(file);
		const displayName =
			cache?.frontmatter?.[this.nameField] ??
			file.parent?.name ??
			file.basename;

		// Read file content
		const text = await this.app.vault.cachedRead(file);

		// Parse references from content
		const { relativePaths, absolutePaths } = parseReferences(text);
		const dir = file.parent?.path ?? "";
		const references: string[] = [];
		const unresolvedRefs: string[] = [];

		// Resolve relative paths
		for (const ref of relativePaths) {
			const resolved = this.resolveRefPath(ref, dir);
			if (resolved) {
				references.push(resolved);
			} else {
				// Skip paths with placeholders (e.g. [market], YYYY-MM)
				if (!/[\[\]{}]/.test(ref) && !/YYYY/.test(ref)) {
					unresolvedRefs.push(ref);
				}
			}
		}

		// Resolve absolute paths: strip vault base path prefix to get vault-relative path
		const vaultBasePath = (this.app.vault.adapter as any).basePath as string | undefined;
		if (vaultBasePath) {
			for (const absPath of absolutePaths) {
				const vaultRelative = this.absoluteToVaultPath(absPath, vaultBasePath);
				if (vaultRelative && this.app.vault.getAbstractFileByPath(vaultRelative)) {
					references.push(vaultRelative);
				}
				// Absolute paths that don't match are silently ignored (may be from another machine)
			}
		}

		this.skillMap.set(file.path, {
			filePath: file.path,
			displayName,
			references,
			unresolvedRefs,
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
	 * Example — vault = /Users/Hana/OpenClaw/mojo/skills:
	 *   /Users/Hana/OpenClaw/mojo/skills/threads-reply/scripts/fetch.py
	 *   → threads-reply/scripts/fetch.py
	 *
	 * Note: Absolute paths from other machines (e.g. /Users/harb/...) will not
	 * match and are silently ignored. SKILL.md files should use {baseDir}/-relative
	 * paths instead.
	 */
	private absoluteToVaultPath(absPath: string, vaultBasePath: string): string | null {
		const prefix = vaultBasePath.endsWith("/") ? vaultBasePath : vaultBasePath + "/";
		if (absPath.startsWith(prefix)) {
			return absPath.substring(prefix.length);
		}
		return null;
	}

	/** Called when the metadata cache reports a file change */
	async onMetadataChanged(file: TFile): Promise<void> {
		if (file.name === this.skillFileName) {
			await this.parseSkillFile(file);
		}
	}

	/** Remove a deleted file's entry from the skill map */
	onFileDeleted(filePath: string): void {
		this.skillMap.delete(filePath);
	}
}
