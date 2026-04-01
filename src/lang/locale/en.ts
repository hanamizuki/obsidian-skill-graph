// English locale — also serves as the type definition for all translations
const en = {
	// Settings tab header
	"settings-heading": "Agent Skill Graph",

	// Setting names
	"skill-file-name": "Skill file name",
	"skill-file-name-desc": "The filename to scan for skills (default: SKILL.md)",
	"name-field": "Name field",
	"name-field-desc": "YAML frontmatter field to use as display name",
	"skill-node-color": "Skill node color",
	"skill-node-color-desc": "Hex color for SKILL.md nodes",
	"reference-node-color": "Reference node color",
	"reference-node-color-desc": "Hex color for referenced files within vault",
	"external-reference-color": "External reference color",
	"external-reference-color-desc": "Hex color for files outside the vault",

	// Footer
	"footer-text": "Agent Skill Graph — visualize your AI agent skill structures.",
	"footer-github": "GitHub",
};

export default en;
export type Lang = typeof en;
