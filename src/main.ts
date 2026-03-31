import { Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, SkillGraphSettingTab } from "./settings";
import type { SkillGraphSettings } from "./settings";
import { SkillParser } from "./skill-parser";
import { GraphPatcher } from "./graph-patcher";

export default class SkillGraphPlugin extends Plugin {
	settings: SkillGraphSettings = DEFAULT_SETTINGS;
	private parser!: SkillParser;
	private patcher!: GraphPatcher;
	/** debounce timer ID */
	private patchTimer: number | null = null;

	async onload() {
		await this.loadSettings();

		// 初始化模組
		this.parser = new SkillParser(
			this.app,
			this.settings.skillFileName,
			this.settings.nameField
		);
		this.patcher = new GraphPatcher(this.app, this.parser.skillMap, this.settings);

		// 等 vault 載入完成後再全量掃描
		this.app.workspace.onLayoutReady(async () => {
			await this.parser.fullScan();
			this.injectLinks();
			this.patcher.patchAllGraphs();
		});

		// 監聽 metadata cache 變更（SKILL.md 被編輯時）
		this.registerEvent(
			this.app.metadataCache.on("changed", async (file: TFile) => {
				await this.parser.onMetadataChanged(file);
				this.injectLinks();
				this.debouncedPatch();
			})
		);

		// 監聽檔案刪除
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				this.parser.onFileDeleted(file.path);
				this.debouncedPatch();
			})
		);

		// 監聽檔案重新命名：先清除舊路徑的 skillMap，再重新解析新路徑
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

		// 監聽 layout 變更（graph view 開啟/切換時），debounce 避免頻繁觸發
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.debouncedPatch();
			})
		);

		// 設定頁面
		this.addSettingTab(new SkillGraphSettingTab(this.app, this));
	}

	onunload() {
		// 清除 debounce timer
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
		// 設定變更時重新掃描
		await this.parser.updateSettings(
			this.settings.skillFileName,
			this.settings.nameField
		);
		this.patcher.updateSettings(this.settings);
		this.patcher.patchAllGraphs();
	}

	/**
	 * 在 metadataCache 注入連結：
	 * - resolvedLinks：vault 內的引用（graph 顯示實線）
	 * - unresolvedLinks：vault 外的引用（graph 顯示虛擬節點）
	 */
	private injectLinks(): void {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = (this.app.metadataCache as any).unresolvedLinks as
			Record<string, Record<string, number>> | undefined;

		for (const [skillPath, skillInfo] of this.parser.skillMap) {
			// 注入 vault 內引用到 resolvedLinks
			if (!resolvedLinks[skillPath]) {
				resolvedLinks[skillPath] = {};
			}
			for (const refPath of skillInfo.references) {
				resolvedLinks[skillPath][refPath] = (resolvedLinks[skillPath][refPath] ?? 0) + 1;
			}

			// 注入 vault 外引用到 unresolvedLinks（顯示為虛擬節點）
			if (unresolvedLinks && skillInfo.unresolvedRefs.length > 0) {
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
	 * 清除之前注入的 resolvedLinks 和 unresolvedLinks。
	 */
	private cleanupLinks(): void {
		const resolvedLinks = this.app.metadataCache.resolvedLinks;
		const unresolvedLinks = (this.app.metadataCache as any).unresolvedLinks as
			Record<string, Record<string, number>> | undefined;

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

	/** Debounced patch — 200ms 內重複觸發只執行一次 */
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
