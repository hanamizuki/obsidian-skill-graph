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
			// 以 SKILL.md 所在目錄為基準解析相對路徑
			const fullPath = dir ? `${dir}/${ref}` : ref;
			// 確認檔案存在於 vault
			const target = this.app.vault.getAbstractFileByPath(fullPath);
			if (target) {
				references.push(fullPath);
			}
		}

		this.skillMap.set(file.path, {
			filePath: file.path,
			displayName,
			references,
		});
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
