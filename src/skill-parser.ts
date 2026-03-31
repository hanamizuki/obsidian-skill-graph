import { App, TFile } from "obsidian";
import { parseReferences } from "./parse-references";
import type { SkillInfo } from "./types";

/**
 * 掃描 vault 中的 SKILL.md 並解析技能資訊。
 * 監聽 metadata cache 變更做增量更新。
 */
export class SkillParser {
	private app: App;
	private skillFileName: string;
	private nameField: string;
	/** 全域技能資訊 Map，key = vault 內相對路徑 */
	skillMap: Map<string, SkillInfo> = new Map();

	constructor(app: App, skillFileName: string, nameField: string) {
		this.app = app;
		this.skillFileName = skillFileName;
		this.nameField = nameField;
	}

	/** 更新設定後重新掃描 */
	async updateSettings(
		skillFileName: string,
		nameField: string
	): Promise<void> {
		this.skillFileName = skillFileName;
		this.nameField = nameField;
		await this.fullScan();
	}

	/** 全量掃描 vault 中所有 SKILL.md */
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

	/** 單一檔案解析 */
	async parseSkillFile(file: TFile): Promise<void> {
		if (file.name !== this.skillFileName) return;

		// 取 frontmatter name
		const cache = this.app.metadataCache.getFileCache(file);
		const displayName =
			cache?.frontmatter?.[this.nameField] ??
			file.parent?.name ??
			file.basename;

		// 讀取內文
		const text = await this.app.vault.cachedRead(file);

		// 解析 vault 內引用
		const rawRefs = parseReferences(text);
		const dir = file.parent?.path ?? "";
		const references: string[] = [];
		for (const ref of rawRefs) {
			const resolved = this.resolveRefPath(ref, dir);
			if (resolved) {
				references.push(resolved);
			}
		}

		this.skillMap.set(file.path, {
			filePath: file.path,
			displayName,
			references,
		});
	}

	/**
	 * 嘗試多種策略解析引用路徑，回傳 vault 內的路徑。
	 * 策略順序：
	 * 1. 相對於 SKILL.md 所在目錄（如 scripts/run.sh → content-planner/scripts/run.sh）
	 * 2. 直接從 vault 根目錄（如 content-analysis/SKILL.md）
	 * 3. 去掉 vault 資料夾名前綴（如 skills/content-analysis/SKILL.md → content-analysis/SKILL.md）
	 */
	private resolveRefPath(ref: string, parentDir: string): string | null {
		// 策略 1：相對於 SKILL.md 的父目錄
		const relPath = parentDir ? `${parentDir}/${ref}` : ref;
		if (this.app.vault.getAbstractFileByPath(relPath)) {
			return relPath;
		}

		// 策略 2：從 vault 根目錄直接查找
		if (this.app.vault.getAbstractFileByPath(ref)) {
			return ref;
		}

		// 策略 3：去掉第一層目錄前綴再查找
		// 處理 workspace 相對路徑（如 skills/content-analysis/SKILL.md）
		// 當 vault 根目錄就是 skills/ 時，需要去掉 skills/ 前綴
		const slashIdx = ref.indexOf("/");
		if (slashIdx !== -1) {
			const stripped = ref.substring(slashIdx + 1);
			if (this.app.vault.getAbstractFileByPath(stripped)) {
				return stripped;
			}
		}

		return null;
	}

	/** metadata cache 變更時的回呼 */
	async onMetadataChanged(file: TFile): Promise<void> {
		if (file.name === this.skillFileName) {
			await this.parseSkillFile(file);
		}
	}

	/** 移除被刪除檔案的資訊 */
	onFileDeleted(filePath: string): void {
		this.skillMap.delete(filePath);
	}
}
