import { App, PluginSettingTab, Setting } from "obsidian";
import type SkillGraphPlugin from "./main";

export interface SkillGraphSettings {
	/** 要掃描的檔名，預設 "SKILL.md" */
	skillFileName: string;
	/** frontmatter 中用來當 display name 的欄位 */
	nameField: string;
	/** Skill 主節點顏色 */
	colorSkill: string;
	/** 本地引用節點顏色（被 SKILL.md 引用的 references/scripts） */
	colorLocalRef: string;
}

export const DEFAULT_SETTINGS: SkillGraphSettings = {
	skillFileName: "SKILL.md",
	nameField: "name",
	colorSkill: "#4a9eff",
	colorLocalRef: "#a0c4e8",
};

export class SkillGraphSettingTab extends PluginSettingTab {
	plugin: SkillGraphPlugin;

	constructor(app: App, plugin: SkillGraphPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Skill file name")
			.setDesc("The filename to scan for skills (default: SKILL.md)")
			.addText((text) =>
				text
					.setPlaceholder("SKILL.md")
					.setValue(this.plugin.settings.skillFileName)
					.onChange(async (value) => {
						this.plugin.settings.skillFileName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Name field")
			.setDesc("YAML frontmatter field to use as display name")
			.addText((text) =>
				text
					.setPlaceholder("name")
					.setValue(this.plugin.settings.nameField)
					.onChange(async (value) => {
						this.plugin.settings.nameField = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Skill node color")
			.setDesc("Hex color for SKILL.md nodes (e.g. #4a9eff)")
			.addText((text) =>
				text
					.setPlaceholder("#4a9eff")
					.setValue(this.plugin.settings.colorSkill)
					.onChange(async (value) => {
						this.plugin.settings.colorSkill = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Reference node color")
			.setDesc("Hex color for referenced files (scripts/, references/)")
			.addText((text) =>
				text
					.setPlaceholder("#a0c4e8")
					.setValue(this.plugin.settings.colorLocalRef)
					.onChange(async (value) => {
						this.plugin.settings.colorLocalRef = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
