import { App, PluginSettingTab, Setting } from "obsidian";
import type SkillGraphPlugin from "./main";

export interface SkillGraphSettings {
	/** 要掃描的檔名，預設 "SKILL.md" */
	skillFileName: string;
	/** frontmatter 中用來當 display name 的欄位 */
	nameField: string;
}

export const DEFAULT_SETTINGS: SkillGraphSettings = {
	skillFileName: "SKILL.md",
	nameField: "name",
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
	}
}
