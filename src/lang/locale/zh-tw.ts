import type { Lang } from "./en";

const zhTW: Partial<Lang> = {
	// Settings tab header
	"settings-heading": "Agent Skill Graph",

	// Setting names
	"skill-file-name": "技能檔名",
	"skill-file-name-desc": "要掃描的檔名（預設：SKILL.md）",
	"name-field": "名稱欄位",
	"name-field-desc": "YAML frontmatter 中用來當顯示名稱的欄位",
	"skill-node-color": "技能節點顏色",
	"skill-node-color-desc": "SKILL.md 節點的 hex 色碼",
	"reference-node-color": "引用節點顏色",
	"reference-node-color-desc": "Vault 內被引用檔案的 hex 色碼",
	"external-reference-color": "外部引用顏色",
	"external-reference-color-desc": "Vault 外部檔案的 hex 色碼",

	// Footer
	"footer-text": "Agent Skill Graph — 視覺化 AI Agent 的技能結構。",
	"footer-github": "GitHub",
};

export default zhTW;
