// === Skill data structures ===

/** 一個 SKILL.md 解析出的完整資訊 */
export interface SkillInfo {
	/** vault 內的相對路徑，如 "content-planner/SKILL.md" */
	filePath: string;
	/** frontmatter 的 name 欄位值 */
	displayName: string;
	/** vault 內被引用的檔案路徑 */
	references: string[];
}

// === Obsidian undocumented API type extensions ===

/** Graph renderer node（未公開 API） */
export interface GraphNode {
	id: string;
	getDisplayText(): string;
	/** patch 標記，避免重複覆寫 */
	_skillGraphPatched?: boolean;
	/** 儲存原始的 getDisplayText，cleanup 時恢復 */
	_originalGetDisplayText?: () => string;
}

/** Graph renderer（未公開 API） */
export interface GraphRenderer {
	nodes: GraphNode[];
	edges: GraphEdge[];
}

/** Graph edge（未公開 API） */
export interface GraphEdge {
	source: GraphNode;
	target: GraphNode;
	/** plugin 注入的邊標記，cleanup 時用來過濾移除 */
	_skillGraphInjected?: boolean;
}

/** Graph view（未公開 API） */
export interface GraphView {
	renderer?: GraphRenderer;
	getDisplayText(): string;
	getViewType(): string;
}
