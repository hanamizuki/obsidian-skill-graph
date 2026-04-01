import { Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, SkillGraphSettingTab } from "./settings";
import type { SkillGraphSettings } from "./settings";
import { SkillParser } from "./skill-parser";
import { GraphPatcher } from "./graph-patcher";
// Import types.ts to activate module augmentation (MetadataCache.unresolvedLinks, etc.)
import "./types";

export default class SkillGraphPlugin extends Plugin {
	settings: SkillGraphSettings = DEFAULT_SETTINGS;
	private parser!: SkillParser;
	private patcher!: GraphPatcher;
	/** debounce timer ID */
	private patchTimer: number | null = null;
	/** Periodic patch interval for catching dynamically added nodes (e.g. graph animation mode) */
	private periodicPatchInterval: number | null = null;

	async onload() {
		await this.loadSettings();

		// Initialize modules
		this.parser = new SkillParser(
			this.app,
			this.settings.skillFileName,
			this.settings.nameField
		);
		this.patcher = new GraphPatcher(this.app, this.parser.skillMap, this.settings);

		// Wait for vault to finish loading before running full scan
		this.app.workspace.onLayoutReady(async () => {
			await this.parser.fullScan();
			this.injectLinks();
			this.patcher.patchAllGraphs();
		});

		// Listen for metadata cache changes (when SKILL.md is edited)
		this.registerEvent(
			this.app.metadataCache.on("changed", async (file: TFile) => {
				await this.parser.onMetadataChanged(file);
				this.injectLinks();
				this.debouncedPatch();
			})
		);

		// Listen for file deletions
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.parser.onFileDeleted(file.path);
				this.debouncedPatch();
			})
		);

		// Listen for file renames: clear old path from skillMap, then re-parse new path
		this.registerEvent(
			this.app.vault.on("rename", async (file, oldPath) => {
				this.parser.onFileDeleted(oldPath);
				if (
					file instanceof TFile &&
					file.name === this.settings.skillFileName
				) {
					await this.parser.parseSkillFile(file);
				}
				this.debouncedPatch();
			})
		);

		// Listen for layout changes (graph view open/switch), debounced to avoid excessive triggers
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.debouncedPatch();
			})
		);

		// Periodic patch: catches nodes added dynamically (e.g. graph animation mode)
		// Uses registerInterval for automatic cleanup on plugin unload
		this.periodicPatchInterval = this.registerInterval(
			window.setInterval(() => {
				this.patcher.patchAllGraphs();
			}, 500)
		);

		// Register settings tab
		this.addSettingTab(new SkillGraphSettingTab(this.app, this));
	}

	onunload() {
		// Clear debounce timer
		if (this.patchTimer !== null) {
			window.clearTimeout(this.patchTimer);
		}
		this.cleanupLinks();
		this.patcher.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SkillGraphSettings>
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Re-scan when settings change
		await this.parser.updateSettings(
			this.settings.skillFileName,
			this.settings.nameField
		);
		this.patcher.updateSettings(this.settings);
		this.patcher.patchAllGraphs();
	}

	/**
	 * Inject links into metadataCache:
	 * - resolvedLinks: in-vault references (graph shows solid lines)
	 * - unresolvedLinks: out-of-vault references (graph shows virtual nodes)
	 */
	private injectLinks(): void {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;

		for (const [skillPath, skillInfo] of this.parser.skillMap) {
			// Inject in-vault references into resolvedLinks
			if (!resolvedLinks[skillPath]) {
				resolvedLinks[skillPath] = {};
			}
			for (const refPath of skillInfo.references) {
				resolvedLinks[skillPath][refPath] = (resolvedLinks[skillPath][refPath] ?? 0) + 1;
			}

			// Inject out-of-vault references into unresolvedLinks (displayed as virtual nodes)
			if (skillInfo.unresolvedRefs.length > 0) {
				if (!unresolvedLinks[skillPath]) {
					unresolvedLinks[skillPath] = {};
				}
				for (const extRef of skillInfo.unresolvedRefs) {
					unresolvedLinks[skillPath][extRef] = (unresolvedLinks[skillPath][extRef] ?? 0) + 1;
				}
			}
		}
	}

	/**
	 * Remove previously injected resolvedLinks and unresolvedLinks.
	 */
	private cleanupLinks(): void {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = this.app.metadataCache.unresolvedLinks;

		for (const [skillPath, skillInfo] of this.parser.skillMap) {
			if (resolvedLinks[skillPath]) {
				for (const refPath of skillInfo.references) {
					delete resolvedLinks[skillPath][refPath];
				}
			}
			if (unresolvedLinks?.[skillPath]) {
				for (const extRef of skillInfo.unresolvedRefs) {
					delete unresolvedLinks[skillPath][extRef];
				}
			}
		}
	}

	/** Debounced patch — fires at most once per 200ms burst */
	private debouncedPatch(): void {
		if (this.patchTimer !== null) {
			window.clearTimeout(this.patchTimer);
		}
		this.patchTimer = window.setTimeout(() => {
			this.patchTimer = null;
			this.patcher.patchAllGraphs();
		}, 200);
	}
}
