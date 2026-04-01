import { App, PluginSettingTab, Setting } from "obsidian";
import type SkillGraphPlugin from "./main";
import { t } from "./lang/helpers";

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

		new Setting(containerEl).setName(t("settings-heading")).setHeading();

		new Setting(containerEl)
			.setName(t("skill-file-name"))
			.setDesc(t("skill-file-name-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Skill.md")
					.setValue(this.plugin.settings.skillFileName)
					.onChange(async (value) => {
						this.plugin.settings.skillFileName = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("name-field"))
			.setDesc(t("name-field-desc"))
			.addText((text) =>
				text
					.setPlaceholder("Name")
					.setValue(this.plugin.settings.nameField)
					.onChange(async (value) => {
						this.plugin.settings.nameField = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("skill-node-color"))
			.setDesc(t("skill-node-color-desc"))
			.addText((text) =>
				text
					.setPlaceholder("#de7356")
					.setValue(this.plugin.settings.colorSkill)
					.onChange(async (value) => {
						this.plugin.settings.colorSkill = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("reference-node-color"))
			.setDesc(t("reference-node-color-desc"))
			.addText((text) =>
				text
					.setPlaceholder("#5b8ca4")
					.setValue(this.plugin.settings.colorLocalRef)
					.onChange(async (value) => {
						this.plugin.settings.colorLocalRef = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("external-reference-color"))
			.setDesc(t("external-reference-color-desc"))
			.addText((text) =>
				text
					.setPlaceholder("#dbdbdb")
					.setValue(this.plugin.settings.colorExternalRef)
					.onChange(async (value) => {
						this.plugin.settings.colorExternalRef = value;
						await this.plugin.saveSettings();
					})
			);

		// Footer
		containerEl.createEl("hr");
		const footerEl = containerEl.createEl("div", {
			cls: "setting-item-description",
			attr: { style: "text-align: center; margin-top: 1em;" },
		});
		footerEl.createEl("p", { text: t("footer-text") });
		const linkEl = footerEl.createEl("a", {
			text: t("footer-github"),
			href: "https://github.com/hanamizuki/obsidian-skill-graph",
		});
		linkEl.setAttr("target", "_blank");
	}
}
