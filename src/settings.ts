import { App, PluginSettingTab, Setting } from "obsidian";
import type SkillGraphPlugin from "./main";

export interface SkillGraphSettings {
	/** Filename to scan for skills, default "SKILL.md" */
	skillFileName: string;
	/** Frontmatter field to use as the display name */
	nameField: string;
	/** Color for skill root nodes */
	colorSkill: string;
	/** Color for local reference nodes (files referenced by SKILL.md, e.g. references/, scripts/) */
	colorLocalRef: string;
	/** Color for external reference nodes (files outside the vault) */
	colorExternalRef: string;
}

export const DEFAULT_SETTINGS: SkillGraphSettings = {
	skillFileName: "SKILL.md",
	nameField: "name",
	colorSkill: "#DE7356",
	colorLocalRef: "#5B8CA4",
	colorExternalRef: "#DBDBDB",
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
			.setDesc("Hex color for referenced files within vault (scripts/, references/)")
			.addText((text) =>
				text
					.setPlaceholder("#a0c4e8")
					.setValue(this.plugin.settings.colorLocalRef)
					.onChange(async (value) => {
						this.plugin.settings.colorLocalRef = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("External reference color")
			.setDesc("Hex color for files outside the vault (workspace shared resources)")
			.addText((text) =>
				text
					.setPlaceholder("#c4a0e8")
					.setValue(this.plugin.settings.colorExternalRef)
					.onChange(async (value) => {
						this.plugin.settings.colorExternalRef = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
